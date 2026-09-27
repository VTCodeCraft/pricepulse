// Scrapes the price and stock of one product option with a real browser.
// The store's own page code does the handshake, the temporary pass and the quote; we drive the page like a user,
// then read the result from the DOM and check it against the quote response the page received.
import { chromium } from 'playwright';
import { config } from '../config.js';
import { installFaults } from './faults.js';
import { checkDomContract, hashManifest, hashSchema, pageStructure } from './layout.js';
import { extractOffer, htmlToElement } from './parser.js';
import { ScrapeError, runWithRetry, sleep } from './retry.js';
import { getItem } from './store.js';

export async function launchBrowser({ headed = !config.headless, slowMo = 0 } = {}) {
  try {
    return await chromium.launch({ headless: !headed, slowMo, channel: config.browserChannel });
  } catch (error) {
    throw new ScrapeError('browser_launch_failed', firstLine(error.message));
  }
}

const CONTEXT_OPTIONS = { viewport: { width: 1280, height: 900 }, locale: 'en-IN', timezoneId: 'UTC' };

// One browser context for the options of one product in a run: they share cookies, cache and the consent choice,
// while each option still gets its own page load, option check and quote check. Close it after the product.
export async function openProductSession(browser) {
  return browser.newContext(CONTEXT_OPTIONS);
}

// Up to config.maxTries tries. Pass `browser` to share one across scrapes (the runner does); otherwise one is launched
// here and closed at the end. Only one browser at a time: Render has 512 MB. With a product `session` the first try
// runs in it; a retry always gets a fresh context, so a failure never carries over into the next try.
export async function scrapeWithRetry(target, { browser, session, headed, slowMo, faultPlan, log = () => {} } = {}) {
  let ownBrowser;
  const liveBrowser = async () => {
    if (browser?.isConnected()) return browser;
    if (!ownBrowser?.isConnected()) ownBrowser = await launchBrowser({ headed, slowMo }); // also relaunches after a crash
    return ownBrowser;
  };
  try {
    return await runWithRetry(
      async tryNumber => {
        log(`try ${tryNumber}/${config.maxTries}`);
        const shared = tryNumber === 1 && session?.browser()?.isConnected() ? session : undefined;
        return scrapeOption(await liveBrowser(), target, { faultPlan, log, session: shared });
      },
      {
        maxTries: config.maxTries,
        baseDelayMs: config.retryBaseDelayMs,
        onRetry: ({ error, delayMs }) => log(`try failed (${error.code}: ${error.message}); retrying in ${(delayMs / 1000).toFixed(1)} s`),
      },
    );
  } finally {
    await ownBrowser?.close().catch(() => {});
  }
}

// One try. Returns a validated result or throws a ScrapeError; never returns a partial result.
export async function scrapeOption(browser, { productId, optionId }, { faultPlan, session, log = () => {} } = {}) {
  const started = Date.now();
  const timingsMs = {};
  const mark = (phase, detail) => {
    timingsMs[phase] = Date.now() - started;
    log(detail ? `${phase}: ${detail}` : phase);
  };

  // HTTP preflight: a missing product or option is permanent, and needs no browser.
  const item = await getItem(productId);
  const option = item.options.find(o => o.id === optionId);
  if (!option) {
    throw new ScrapeError('option_not_found', `product ${productId} has no option ${optionId} (it has ${item.options.map(o => o.id).join(', ')})`);
  }
  mark('preflight', `${item.name} / ${option.label}`);

  let context;
  let page;
  let timedOut = false;
  // Closing the page (or our own context) makes every pending Playwright call fail at once, which ends the try.
  const watchdog = setTimeout(() => {
    timedOut = true;
    (session ? page : context)?.close().catch(() => {});
  }, config.tryTimeoutMs);

  try {
    context = session ?? (await browser.newContext(CONTEXT_OPTIONS));
    page = await context.newPage();
    const traffic = recordStoreTraffic(page);
    if (faultPlan) await installFaults(page, faultPlan);
    const evidence = { clicks: 0, pendingRechecks: 0, consentClicks: 0, sharedSession: Boolean(session) };
    await dismissConsentWhenShown(page, evidence);

    await page.goto(`${config.storeBaseUrl}/item/${productId}`, { waitUntil: 'domcontentloaded', timeout: config.navTimeoutMs });
    const panel = page.locator('.offer-panel');
    await panel.waitFor({ timeout: config.navTimeoutMs });
    const manifest = await traffic.manifest(config.navTimeoutMs);
    const dom = checkDomContract(htmlToElement(await page.locator('.pdp-summary').evaluate(el => el.outerHTML)));
    if (!dom.ok) throw new ScrapeError('layout_changed', `page structure changed: missing ${dom.missing.join(', ')}`);
    mark('page ready', `layout revision ${manifest.revision}`);

    const chip = page.getByRole('group', { name: item.optionAxis }).getByRole('button', { name: option.label, exact: true });
    await chip.click();
    await expectSelected(chip, option.label);
    mark('option selected', option.label);

    const checkButton = panel.getByRole('button', { name: /Check today/ });
    await unlock(panel, checkButton);
    mark('price button unlocked');

    let clickedAt = Date.now();
    evidence.clicks += await clickUntilAccepted(page, checkButton);
    await waitForTerminalState(page);
    let offer;
    let panelElement;
    for (;;) {
      try {
        panelElement = htmlToElement(await panel.evaluate(el => el.outerHTML));
        offer = extractOffer(panelElement, manifest);
        break;
      } catch (error) {
        if (error.code !== 'pending_price' || evidence.pendingRechecks >= config.pendingRechecks) throw error;
        evidence.pendingRechecks++;
        log(`price still refreshing (${error.details.displayed.price}); checking again`);
        clickedAt = Date.now();
        evidence.clicks += await clickUntilAccepted(page, panel.getByRole('button', { name: 'Check again' }));
        await waitForTerminalState(page);
      }
    }
    mark('price loaded', offer.displayed.price);

    // The number on screen must come from a quote for this exact product and option, fetched after our last click.
    await traffic.bodiesRead();
    const quote = checkQuoteProvenance(traffic.quotes, { productId, optionId, since: clickedAt });
    await expectSelected(chip, option.label);

    return {
      productId,
      productName: item.name,
      optionId,
      optionLabel: option.label,
      price: offer.price,
      currency: offer.currency,
      stock: offer.stock,
      displayed: offer.displayed,
      layout: {
        revision: manifest.revision,
        variant: manifest.variant,
        manifestHash: hashManifest(manifest),
        schemaHash: hashSchema(manifest),
        structure: pageStructure(panelElement, manifest),
      },
      evidence: {
        ...evidence,
        storeFailures: traffic.failureCount(),
        storeAttempts: offer.storeAttempts,
        quote: { status: quote.status, itemId: quote.itemId, option: quote.option },
        decoys: offer.decoys,
      },
      timingsMs,
    };
  } catch (error) {
    if (timedOut) throw new ScrapeError('timeout', `try took longer than ${config.tryTimeoutMs} ms`);
    throw toScrapeError(error);
  } finally {
    clearTimeout(watchdog);
    await (session ? page : context)?.close().catch(() => {});
  }
}

// Pure: picks the last quote response after `since` and checks it belongs to the requested product and option.
export function checkQuoteProvenance(quotes, { productId, optionId, since }) {
  const latest = quotes.filter(q => q.at >= since).at(-1);
  if (!latest) throw new ScrapeError('option_mismatch', 'no quote response was seen after our click');
  if (latest.status !== 200) throw new ScrapeError('option_mismatch', `last quote response was HTTP ${latest.status}`);
  const matches = latest.pathItemId === productId && latest.urlOption === optionId
    && latest.itemId === productId && latest.option === optionId;
  if (!matches) {
    throw new ScrapeError('option_mismatch',
      `quote was for ${latest.itemId}/${latest.option} (URL ${latest.pathItemId}/${latest.urlOption}), expected ${productId}/${optionId}`);
  }
  return latest;
}

function recordStoreTraffic(page) {
  const quotes = [];
  const bodies = [];
  let manifest;
  let failures = 0;
  const isStoreCall = path => path === '/api/v2/handshake' || /^\/api\/v2\/items\/\d+\/quote$/.test(path);

  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== config.storeBaseUrl) return;
    if (url.pathname === '/api/v2/ui/manifest' && response.ok()) {
      bodies.push(response.json().then(body => { manifest = body; }, () => {}));
      return;
    }
    if (!isStoreCall(url.pathname)) return;
    if (response.status() !== 200) failures++;
    const quotePath = url.pathname.match(/^\/api\/v2\/items\/(\d+)\/quote$/);
    if (!quotePath) return;
    // Recorded before the body is read, so the order of `quotes` is the order responses arrived.
    const quote = { at: Date.now(), status: response.status(), pathItemId: Number(quotePath[1]), urlOption: url.searchParams.get('opt') };
    quotes.push(quote);
    if (response.ok()) {
      bodies.push(response.json().then(body => { quote.itemId = body?.itemId; quote.option = body?.option; }, () => {}));
    }
  });
  page.on('requestfailed', request => {
    if (isStoreCall(new URL(request.url()).pathname)) failures++;
  });

  return {
    quotes,
    failureCount: () => failures,
    bodiesRead: () => Promise.all(bodies),
    async manifest(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (!manifest) {
        if (Date.now() > deadline) throw new ScrapeError('layout_changed', 'the page never loaded its layout manifest');
        await sleep(100);
      }
      return manifest;
    },
  };
}

// The cookie dialog appears 1.5–5 s after load and can need up to 3 clicks; Playwright runs this whenever it blocks an action.
// Playwright calls the handler from an event listener and does not catch what it throws, so an error here (typically the
// context closing mid-click) would crash the process. The blocked action in scrapeOption then fails and is classified there.
export async function dismissConsentWhenShown(page, evidence) {
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'Privacy preferences' }), async dialog => {
    try {
      for (let i = 0; i < 5 && (await dialog.isVisible()); i++) {
        await dialog.getByRole('button', { name: 'Reject cookies' }).click();
        evidence.consentClicks++;
      }
    } catch {
      // deliberately ignored: the scrape's own blocked action reports the failure
    }
  });
}

async function expectSelected(chip, label) {
  for (let i = 0; i < 20; i++) {
    if ((await chip.getAttribute('aria-pressed')) === 'true') return;
    await sleep(100);
  }
  throw new ScrapeError('option_mismatch', `option "${label}" is not selected on the page`);
}

// The price button stays disabled until the pointer has moved over the panel and stayed there for a moment.
async function unlock(panel, button) {
  for (let round = 0; round < 3; round++) {
    if (await button.isEnabled()) return;
    const box = await panel.boundingBox();
    for (let i = 0; i < 12; i++) {
      await panel.hover({ position: { x: 20 + i * ((box.width - 40) / 11), y: box.height / 2 } });
      await sleep(60);
    }
    await sleep(800);
  }
  if (!(await button.isEnabled())) throw new ScrapeError('unlock_failed', 'price button stayed disabled after hovering');
}

// The store silently ignores some clicks; a click counts once the page starts its handshake request.
async function clickUntilAccepted(page, button) {
  for (let click = 1; click <= 4; click++) {
    const handshakeStarted = page
      .waitForRequest(r => r.method() === 'GET' && new URL(r.url()).pathname === '/api/v2/handshake', { timeout: 2_500 })
      .then(() => true, () => false);
    await button.click();
    if (await handshakeStarted) return click;
  }
  throw new ScrapeError('click_ignored', 'the price button ignored 4 clicks');
}

async function waitForTerminalState(page) {
  await page.locator('.offer-panel[aria-busy="true"]').waitFor({ timeout: 5_000 });
  await page.locator('.offer-panel.offer-ready, .offer-panel.offer-failed').waitFor({ timeout: config.quoteTimeoutMs });
}

// Playwright errors carry a long call log after the first line; keep only the first line.
export function toScrapeError(error) {
  if (error instanceof ScrapeError) return error;
  const message = firstLine(error.message);
  if (error.name === 'TimeoutError') return new ScrapeError('timeout', message);
  if (/has been closed|disconnected|crashed/i.test(message)) return new ScrapeError('browser_crash', message);
  if (/net::ERR_/.test(message)) return new ScrapeError('network', message);
  return new ScrapeError('unexpected', message);
}

const firstLine = text => String(text).split('\n')[0];
