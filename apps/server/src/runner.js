// One scrape run: take the DB lock, pick the options to scrape, scrape them one by one with the Phase 3 scraper,
// and record every attempt honestly (a failed attempt never carries a price or stock).
import os from 'node:os';
import { config } from './config.js';
import * as db from './db.js';
import { hashManifest, hashSchema, validateManifest } from './layout.js';
import { parsePrice } from './parse.js';
import { ScrapeError, sleep } from './retry.js';
import { DEFAULT_INTERVAL, SCRAPE_INTERVALS, isDue, nextSlotAfterRun } from './schedule.js';
import { launchBrowser, scrapeWithRetry } from './scraper.js';
import { getItem, getManifest } from './store.js';

// trigger: 'cron' | 'manual' | 'initial' | 'cli'. By default only due options are scraped;
// trackedIds picks specific rows and force picks every active row.
export async function runTick({ trigger, trackedIds, force = false, faultPlan, log = () => {} }) {
  const reaped = await db.reapStaleRuns(config.staleRunMinutes);
  if (reaped.length) log(`closed stale run(s) ${reaped.join(', ')} as abandoned`);

  const run = await db.startRun({ trigger, host: os.hostname(), faultInjection: faultPlan ?? null });
  if (!run) {
    log('another run is in progress; nothing started');
    return { status: 'busy' };
  }

  const tickAt = new Date();
  const counts = { success: 0, retried: 0, failed: 0 };
  let browser;
  try {
    const targets = trackedIds
      ? await db.getTrackedByIds(trackedIds)
      : (await db.listActiveTracked()).filter(t => force || isDue(t.next_scrape_at, tickAt, config.schedulerToleranceMinutes));
    await db.setRunProductsDue(run.id, targets.length);
    log(`run ${run.id} (${trigger}): ${targets.length} option(s) to scrape`);

    const layoutIds = new Map(); // manifest hash → layout_versions.id, looked up once per run
    let first = true;
    for (const [productId, options] of groupByProduct(targets)) {
      if (!first) await sleep(config.productGapMs);
      first = false;

      // Preflight over HTTP: refresh the product details and find out which options the store still offers.
      let item;
      let preflightError;
      try {
        item = await getItem(productId);
        await db.upsertProduct(item);
      } catch (error) {
        preflightError = error;
      }

      // Phase 3 scrapes one option per page load; Phase 8 will collect several options in one page session.
      for (const tracked of options) {
        const attemptId = await db.startAttempt(run.id, tracked.id);
        let attempt;
        if (preflightError) {
          attempt = failedAttempt(preflightError);
        } else if (!item.options.some(o => o.id === tracked.option_id)) {
          attempt = failedAttempt(new ScrapeError('option_not_found', `product ${productId} no longer offers ${tracked.option_id}`));
        } else {
          let scrape;
          try {
            browser = browser?.isConnected() ? browser : await launchBrowser();
            scrape = await scrapeWithRetry({ productId, optionId: tracked.option_id }, { browser, faultPlan, log });
          } catch (error) {
            scrape = { outcome: 'failed', error, tries: [] }; // the browser could not start: record why
          }
          attempt = scrape.result
            ? successfulAttempt(scrape, await layoutVersionId(scrape.result.layout.manifestHash, layoutIds))
            : failedAttempt(scrape.error, scrape.tries);
        }
        await db.finishAttempt(attemptId, attempt);
        counts[attempt.outcome]++;
        log(`${tracked.product_name} / ${tracked.option_label}: ${attempt.outcome}${attempt.price ? ` ${attempt.currency} ${attempt.price}, stock ${attempt.stock}` : ` (${attempt.errorCode})`}`);

        // Advance the schedule only when this run served the option's slot, so a manual or CLI run
        // never pushes a scheduled scrape further away.
        if (isDue(tracked.next_scrape_at, tickAt, config.schedulerToleranceMinutes)) {
          await db.setNextScrapeAt(tracked.id, nextSlotAfterRun(tracked.next_scrape_at, new Date(), tracked.scrape_interval_minutes));
        }
        await db.touchRun(run.id);
      }
    }

    await db.finishRun(run.id, { status: 'completed', ...counts });
    return { runId: run.id, status: 'completed', due: targets.length, ...counts };
  } catch (error) {
    // Infrastructure failure (database, browser launch): the run itself failed, not a store scrape.
    log(`run ${run.id} failed: ${error.message}`);
    await db.failUnfinishedAttempts([run.id]).catch(() => {});
    await db.finishRun(run.id, { status: 'failed', ...counts, errorMessage: error.message }).catch(() => {});
    return { runId: run.id, status: 'failed', error: error.message, ...counts };
  } finally {
    await browser?.close().catch(() => {});
  }
}

// Starts tracking an option after checking it against the store. Re-tracking re-activates the same row.
export async function trackOption(productId, optionId, { intervalMinutes = DEFAULT_INTERVAL } = {}) {
  if (!SCRAPE_INTERVALS.includes(intervalMinutes)) {
    throw new Error(`interval must be one of ${SCRAPE_INTERVALS.join(', ')} minutes, got ${intervalMinutes}`);
  }
  const item = await getItem(productId);
  const option = item.options.find(o => o.id === optionId);
  if (!option) throw new ScrapeError('option_not_found', `product ${productId} has no option ${optionId}`);
  await db.upsertProduct(item);
  return db.addTrackedProduct({ storeProductId: productId, optionId, optionLabel: option.label, intervalMinutes });
}

function groupByProduct(tracked) {
  const groups = new Map();
  for (const row of tracked) groups.set(row.store_product_id, [...(groups.get(row.store_product_id) ?? []), row]);
  return groups;
}

function successfulAttempt({ outcome, result, tries }, layoutVersionIdValue) {
  const { decoys } = result.evidence;
  return {
    outcome,
    price: result.price,
    currency: result.currency,
    stock: result.stock,
    tries: tries.length,
    layoutVersionId: layoutVersionIdValue,
    layoutRevision: result.layout.revision,
    extras: {
      mrp: priceOrNull(decoys.mrp[0]),
      memberPrice: priceOrNull(decoys.memberPrice[0]?.replace(/^Member price\s*/, '')),
    },
    details: { tries, displayed: result.displayed, evidence: result.evidence, timingsMs: result.timingsMs },
  };
}

function failedAttempt(error, tries = []) {
  return { outcome: 'failed', tries: tries.length, errorCode: error.code ?? 'unexpected', errorMessage: error.message, details: { tries } };
}

// Links the attempt to the manifest the page used. The manifest endpoint returns the same document within a
// revision; if it rotated since the page loaded, the hashes differ and the attempt is left unlinked rather than
// linked to the wrong layout.
async function layoutVersionId(manifestHash, cache) {
  if (cache.has(manifestHash)) return cache.get(manifestHash);
  let id = null;
  try {
    const manifest = await getManifest();
    if (hashManifest(manifest) === manifestHash) {
      id = await db.recordLayoutVersion({
        manifestHash,
        schemaHash: hashSchema(manifest),
        revision: manifest.revision,
        variant: manifest.variant,
        manifest,
        supported: validateManifest(manifest).valid,
      });
    }
  } catch {
    // A missing layout link is not worth failing an otherwise valid attempt.
  }
  cache.set(manifestHash, id);
  return id;
}

function priceOrNull(text) {
  try {
    return text ? parsePrice(text).price : null;
  } catch {
    return null;
  }
}
