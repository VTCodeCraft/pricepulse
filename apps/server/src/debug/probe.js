// PHASE 2 ONLY: proves the browser-gated quote flow works on Render. Delete this directory after the gate.
// The store's own page code does the handshake, pass and quote; we drive the page like a user and read the DOM.
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';

const STORE = 'https://demo.inelabteamdev.com';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runProbe({ id, opt }) {
  const started = performance.now();
  const timings = {};
  const mark = name => { timings[name] = Math.round(performance.now() - started); };
  const memory = startMemorySampler();
  const network = [];
  const evidence = { network, clicks: 0, pendingRechecks: 0, retryClicks: 0, consentClicks: 0 };
  let phase = 'launch';
  let browser;
  let result;

  try {
    browser = await chromium.launch();
    evidence.browserVersion = browser.version();
    mark('browserLaunched');
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-IN', timezoneId: 'UTC' });
    const page = await context.newPage();
    const pageData = recordStoreTraffic(page, id, network);

    // The cookie dialog shows up 1.5-5 s after load and can need up to 3 clicks.
    await page.addLocatorHandler(page.getByRole('dialog', { name: 'Privacy preferences' }), async dialog => {
      for (let i = 0; i < 3 && (await dialog.isVisible()); i++) {
        await dialog.getByRole('button', { name: 'Reject cookies' }).click();
        evidence.consentClicks++;
      }
    });

    phase = 'load';
    await page.goto(`${STORE}/item/${id}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const panel = page.locator('.offer-panel');
    await panel.waitFor({ timeout: 20_000 });
    const { item, manifest } = await pageData.ready(15_000);
    const selectors = manifestSelectors(manifest);
    mark('pageReady');

    phase = 'option';
    const option = item.options.find(o => o.id === opt);
    if (!option) throw new Error(`product ${id} has no option ${opt}`);
    const chip = page.getByRole('group', { name: item.optionAxis }).getByRole('button', { name: option.label, exact: true });
    await chip.click();
    if ((await chip.getAttribute('aria-pressed')) !== 'true') throw new Error(`option "${option.label}" is not selected`);
    mark('optionSelected');

    phase = 'unlock';
    const checkButton = panel.getByRole('button', { name: /Check today/ });
    await unlock(panel, checkButton);
    mark('unlocked');

    phase = 'quote';
    let lastClickAt = Date.now();
    evidence.clicks += await clickUntilAccepted(page, checkButton);
    await waitForTerminal(page);
    if (await isFailed(panel)) {
      // Minimal gate retry: the store page offers one "Retry" button after it gives up.
      evidence.retryClicks++;
      lastClickAt = Date.now();
      evidence.clicks += await clickUntilAccepted(page, panel.getByRole('button', { name: 'Retry' }));
      await waitForTerminal(page);
      if (await isFailed(panel)) throw new Error(`store page gave up: ${(await panel.textContent()).trim()}`);
    }
    // "Refreshing prices" shows a transitional number; ask again until the price settles.
    while (await panel.getByText('Refreshing prices').count()) {
      if (evidence.pendingRechecks === 3) throw new Error('price still refreshing after 3 re-checks');
      evidence.pendingRechecks++;
      lastClickAt = Date.now();
      evidence.clicks += await clickUntilAccepted(page, panel.getByRole('button', { name: 'Check again' }));
      await waitForTerminal(page);
      if (await isFailed(panel)) throw new Error(`store page gave up: ${(await panel.textContent()).trim()}`);
    }
    mark('quoteReady');

    phase = 'provenance';
    const quote = network.filter(n => n.kind === 'quote' && n.at >= lastClickAt).at(-1);
    if (!quote || quote.status !== 200) throw new Error(`no successful quote response after the last click (${JSON.stringify(quote)})`);
    if (quote.opt !== opt || quote.itemId !== id || quote.option !== opt) {
      throw new Error(`quote is for ${quote.itemId}/${quote.option} (url opt ${quote.opt}), expected ${id}/${opt}`);
    }
    if ((await chip.getAttribute('aria-pressed')) !== 'true') throw new Error('option changed during the quote');

    phase = 'extract';
    const priceText = await readSingle(panel, selectors.price);
    const stockText = await readSingle(panel, selectors.stock);
    const { price, currency } = parsePrice(priceText);
    const stock = parseStock(stockText);
    const decoys = {
      hiddenPriceValue: await panel.locator('.price-value').allTextContents(),
      hiddenAmount: await panel.locator('.amount[data-price]').allTextContents(),
      mrp: await panel.locator(`.${manifest.classes.mrp}`).allTextContents(),
      memberPrice: await panel.locator(`.${manifest.classes.sale}`).allTextContents(),
    };
    if ([...decoys.hiddenPriceValue, ...decoys.hiddenAmount, ...decoys.mrp].includes(priceText)) {
      throw new Error(`extracted price "${priceText}" equals a decoy`);
    }
    mark('extracted');

    result = {
      ok: true,
      product: { id, name: item.name, optionAxis: item.optionAxis },
      option,
      price,
      currency,
      stock,
      displayed: { price: priceText, stock: stockText, footer: (await panel.locator('.offer-foot span').first().textContent()) ?? null },
      manifest: { revision: manifest.revision, variant: manifest.variant, ...selectors },
      decoys,
    };
  } catch (error) {
    result = { ok: false, phase, error: error.message };
  } finally {
    const closeStarted = performance.now();
    await browser?.close();
    evidence.browserCloseMs = Math.round(performance.now() - closeStarted);
    evidence.browserProcessesLeft = countBrowserProcesses();
    mark('done');
  }

  return {
    ...result,
    evidence: summarizeEvidence(evidence),
    timingsMs: timings,
    durationMs: timings.done,
    memory: memory.stop(),
    runtime: await runtimeInfo(),
  };
}

function recordStoreTraffic(page, id, network) {
  let item;
  let manifest;
  page.on('response', async response => {
    const url = new URL(response.url());
    if (url.origin !== STORE) return;
    const at = Date.now();
    if (url.pathname === '/api/v2/ui/manifest' && response.ok()) manifest = await response.json();
    else if (url.pathname === `/api/v2/items/${id}` && response.ok()) item = await response.json();
    else if (url.pathname === '/api/v2/handshake') network.push({ kind: 'handshake', method: response.request().method(), status: response.status(), at });
    else if (url.pathname === `/api/v2/items/${id}/quote`) {
      const body = await response.json().catch(() => null);
      network.push({ kind: 'quote', status: response.status(), opt: url.searchParams.get('opt'), itemId: body?.itemId, option: body?.option, at });
    }
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/v2/handshake' || url.pathname.endsWith('/quote')) {
      network.push({ kind: url.pathname.endsWith('/quote') ? 'quote' : 'handshake', status: 'failed', error: request.failure()?.errorText, at: Date.now() });
    }
  });
  return {
    async ready(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (!(item && manifest)) {
        if (Date.now() > deadline) throw new Error(`product or manifest response missing (item=${!!item}, manifest=${!!manifest})`);
        await sleep(100);
      }
      return { item, manifest };
    },
  };
}

// Class names and the tag come from the store; only accept plain identifiers before building selectors.
function manifestSelectors(manifest) {
  const { priceTag, classes } = manifest ?? {};
  const ident = /^[A-Za-z][\w-]*$/;
  if (!ident.test(priceTag ?? '') || !ident.test(classes?.priceValue ?? '') || !ident.test(classes?.stock ?? '')) {
    throw new Error(`unexpected manifest shape: ${JSON.stringify(manifest)}`);
  }
  return { price: `${priceTag}.${classes.priceValue}`, stock: `.${classes.stock}` };
}

async function unlock(panel, button) {
  for (let round = 0; round < 3; round++) {
    if (await button.isEnabled()) return;
    const box = await panel.boundingBox();
    for (let i = 0; i < 12; i++) {
      await panel.hover({ position: { x: 20 + i * ((box.width - 40) / 11), y: box.height / 2 } });
      await sleep(60);
    }
    await sleep(800); // the button unlocks only after the pointer has stayed over the panel for a moment
  }
  if (!(await button.isEnabled())) throw new Error('price button stayed locked');
}

// Some clicks are ignored by the store; a click counts once the page starts its handshake request.
async function clickUntilAccepted(page, button) {
  for (let click = 1; click <= 4; click++) {
    const handshake = page
      .waitForRequest(r => r.method() === 'GET' && new URL(r.url()).pathname === '/api/v2/handshake', { timeout: 2_500 })
      .then(() => true, () => false);
    await button.click();
    if (await handshake) return click;
  }
  throw new Error('price button ignored 4 clicks');
}

async function waitForTerminal(page) {
  await page.locator('.offer-panel[aria-busy="true"]').waitFor({ timeout: 5_000 });
  await page.locator('.offer-panel.offer-ready, .offer-panel.offer-failed').waitFor({ timeout: 45_000 });
}

const isFailed = panel => panel.evaluate(el => el.classList.contains('offer-failed'));

async function readSingle(panel, selector) {
  const elements = panel.locator(selector);
  const count = await elements.count();
  if (count !== 1) throw new Error(`expected exactly 1 element for ${selector}, found ${count}`);
  return elements.textContent();
}

const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

// Minimal parser for the Phase 1 formats (plus the bundle's euro/spaced styles); the real parser is Phase 3.
export function parsePrice(text) {
  // NFKC turns full-width digits into ASCII; \s also covers the U+00A0 used by the "Rs." format.
  const clean = text.normalize('NFKC').replaceAll(ZERO_WIDTH_SPACE, '').replace(/\s+/g, '')
    .replace(/\/-\(incl\.ofalltaxes\)$/, '');
  const match = clean.match(/^(?:₹|Rs\.)([\d.,]+)$/);
  if (!match) throw new Error(`unrecognised price format "${text}"`);
  let amount = match[1];
  if (/^\d{1,3}(?:\.\d{2,3})+,\d{2}$/.test(amount)) amount = amount.replaceAll('.', ',').replace(/,(\d{2})$/, '.$1'); // ₹90.313,00
  const grouped = amount.match(/^(\d+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.(\d{2}))?$/);
  if (!grouped) throw new Error(`unrecognised price format "${text}"`);
  const price = Number(grouped[1].replaceAll(',', '')) + Number(grouped[2] ?? 0) / 100;
  if (!(price > 0)) throw new Error(`price must be positive, got ${price}`);
  return { price, currency: 'INR' };
}

export function parseStock(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean === 'Sold out') return 0;
  const match = clean.match(/^(?:(\d+) units available|Last few: (\d+)|Available \((\d+)\)|Stock: (\d+) remaining|Ready to ship · (\d+) available)$/);
  if (!match) throw new Error(`unrecognised stock text "${text}"`);
  return Number(match.slice(1).find(Boolean));
}

function summarizeEvidence({ network, ...rest }) {
  return {
    ...rest,
    handshakes: network.filter(n => n.kind === 'handshake').map(n => `${n.method} ${n.status}`),
    quotes: network.filter(n => n.kind === 'quote').map(n => (n.status === 200 ? `200 ${n.itemId}/${n.option}` : `${n.status}${n.error ? ` ${n.error}` : ''}`)),
    authorizationFailures: network.filter(n => n.status === 401 || n.status === 403).length,
  };
}

function startMemorySampler() {
  let nodePeak = 0;
  let processesPeak = 0;
  const sample = () => {
    nodePeak = Math.max(nodePeak, process.memoryUsage().rss);
    processesPeak = Math.max(processesPeak, linuxProcessesRss() ?? 0);
  };
  sample();
  const timer = setInterval(sample, 200);
  return {
    stop() {
      clearInterval(timer);
      sample();
      // Summed RSS double-counts shared pages, so it over-estimates; cgroup peak (runtime) is the real container figure.
      return { nodeRssPeakMB: toMB(nodePeak), allProcessesRssPeakMB: processesPeak ? toMB(processesPeak) : null };
    },
  };
}

function linuxProcessesRss() {
  if (process.platform !== 'linux') return null;
  let total = 0;
  for (const pid of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
    try {
      total += Number(readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+) kB/)?.[1] ?? 0) * 1024;
    } catch { /* process exited */ }
  }
  return total;
}

function countBrowserProcesses() {
  if (process.platform !== 'linux') return null;
  return readdirSync('/proc').filter(name => /^\d+$/.test(name)).filter(pid => {
    try { return /chrom/i.test(readFileSync(`/proc/${pid}/cmdline`, 'utf8')); } catch { return false; }
  }).length;
}

async function runtimeInfo() {
  const cgroup = file => { try { return readFileSync(`/sys/fs/cgroup/${file}`, 'utf8').trim(); } catch { return null; } };
  const bytesToMB = value => (value && /^\d+$/.test(value) ? toMB(Number(value)) : value);
  return {
    platform: `${process.platform}/${process.arch}`,
    node: process.version,
    cpus: os.availableParallelism(),
    cgroup: {
      memoryMaxMB: bytesToMB(cgroup('memory.max')),
      memoryPeakMB: bytesToMB(cgroup('memory.peak')),
      memoryCurrentMB: bytesToMB(cgroup('memory.current')),
      cpuMax: cgroup('cpu.max'),
    },
    outboundIPv6: await canConnect('2606:4700:4700::1111', 443),
  };
}

function canConnect(host, port) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port, timeout: 3_000 });
    const done = ok => { socket.destroy(); resolve(ok); };
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

const toMB = bytes => Math.round(bytes / 1024 / 1024);
