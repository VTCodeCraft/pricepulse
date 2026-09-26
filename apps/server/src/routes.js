// The /api routes. Handlers stay thin: validate the input, call db / runner / store, shape the JSON.
// Express 5 passes errors thrown in async handlers to the error handler in app.js.
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { isCatalogSyncing, startCatalogSync } from './catalog.js';
import { config } from './config.js';
import { attemptsToCsv } from './csv.js';
import * as db from './db.js';
import { startTick, trackOption } from './runner.js';
import { SCRAPE_INTERVALS, nextAligned } from './schedule.js';
import { getItem } from './store.js';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const router = Router();
const log = message => console.log(message);
const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// ---- health -----------------------------------------------------------------

// Always 200 while the process is up (Render uses it to decide a deploy is live); the database state is reported inside.
router.get('/health', async (_req, res) => {
  const body = { ok: true, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) };
  try {
    const [migrations, [lastRun]] = await Promise.all([db.appliedMigrations(), db.listRuns(1)]);
    body.database = { status: 'ok', migrations };
    body.lastRun = lastRun ? runJson(lastRun) : null;
  } catch {
    body.database = { status: 'unavailable' };
  }
  res.json(body);
});

// ---- catalogue ----------------------------------------------------------------

router.get('/catalog/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2 || q.length > 100) throw new HttpError(400, 'invalid_request', 'q must be 2 to 100 characters');
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 50, fallback: 20 });
  const catalog = await db.catalogStatus();
  if (catalog.count === 0) {
    startCatalogSync({ log });
    throw new HttpError(503, 'catalog_syncing', 'The product catalogue is loading; try again in about two minutes');
  }
  // Refresh a day-old catalogue in the background; searching keeps working on the current copy meanwhile.
  if (Date.now() - new Date(catalog.synced_at).getTime() > CATALOG_MAX_AGE_MS) startCatalogSync({ log });
  const results = await db.searchProducts(q, limit);
  res.json({
    query: q,
    catalog: { count: catalog.count, syncedAt: catalog.synced_at, syncing: isCatalogSyncing() },
    results: results.map(row => ({ storeProductId: row.store_product_id, name: row.name, brand: row.brand, category: row.category, sku: row.sku })),
  });
});

router.post('/catalog/sync', requireSecret, (_req, res) => {
  if (!startCatalogSync({ log })) throw new HttpError(409, 'sync_in_progress', 'A catalogue sync is already running');
  res.status(202).json({ status: 'started' });
});

// Live from the store, so the options are always current. Also refreshes the cached product details.
router.get('/catalog/products/:storeProductId', async (req, res) => {
  const item = await getItem(positiveInt(req.params.storeProductId, 'storeProductId'));
  await db.upsertProduct(item);
  res.json({
    storeProductId: item.id,
    productUrl: productUrl(item.id),
    name: item.name,
    brand: item.brand,
    category: item.category,
    sku: item.sku,
    description: item.description,
    optionAxis: item.optionAxis,
    options: item.options,
    specs: item.specs,
    reviewSummary: db.reviewSummary(item.reviews),
  });
});

// ---- tracked options ------------------------------------------------------------

router.get('/tracked', async (req, res) => {
  const rows = await db.listTrackedOverview({ includeInactive: req.query.includeInactive === 'true' });
  res.json({ items: rows.map(trackedJson) });
});

router.post('/tracked', async (req, res) => {
  const body = objectBody(req.body, ['storeProductId', 'optionId', 'scrapeIntervalMinutes', 'priceDropThresholdPct']);
  const storeProductId = positiveInt(body.storeProductId, 'storeProductId');
  const optionId = optionIdValue(body.optionId);
  const intervalMinutes = body.scrapeIntervalMinutes === undefined ? undefined : intervalValue(body.scrapeIntervalMinutes);
  const thresholdPct = body.priceDropThresholdPct === undefined ? undefined : thresholdValue(body.priceDropThresholdPct);
  if ((await db.countActiveTracked()) >= config.maxTracked) {
    throw new HttpError(422, 'tracking_limit_reached', `At most ${config.maxTracked} options can be tracked at once`);
  }

  const tracked = await trackOption(storeProductId, optionId, { intervalMinutes, thresholdPct });
  // A new option gets its first scrape straight away, through the normal runner and lock.
  // If another run is busy, the next scheduled tick picks it up (it is due immediately).
  let initialRun = null;
  if (tracked.created) {
    const started = await startTick({ trigger: 'initial', trackedIds: [tracked.id], log });
    initialRun = started.status === 'started' ? { status: 'started', runId: started.runId } : { status: 'busy' };
  }
  res.status(tracked.created ? 201 : 200).json({ tracked: trackedJson(await db.getTrackedOverview(tracked.id)), initialRun });
});

router.get('/tracked/:id', async (req, res) => {
  res.json({ tracked: trackedJson(await findTracked(req.params.id)) });
});

router.patch('/tracked/:id', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  const body = objectBody(req.body, ['scrapeIntervalMinutes', 'priceDropThresholdPct', 'isActive']);
  const changes = {};
  if (body.scrapeIntervalMinutes !== undefined) {
    changes.intervalMinutes = intervalValue(body.scrapeIntervalMinutes);
    changes.nextScrapeAt = nextAligned(new Date(), changes.intervalMinutes); // re-align to the new interval
  }
  if (body.priceDropThresholdPct !== undefined) changes.thresholdPct = thresholdValue(body.priceDropThresholdPct);
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'invalid_request', 'isActive must be true or false');
    changes.isActive = body.isActive;
  }
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'invalid_request', 'Send at least one of scrapeIntervalMinutes, priceDropThresholdPct, isActive');
  }
  if (!(await db.updateTracked(id, changes))) throw notFound('tracked option', id);
  res.json({ tracked: trackedJson(await db.getTrackedOverview(id)) });
});

// Untracking keeps the row and its history; tracking the same option again re-activates it.
router.delete('/tracked/:id', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  if (!(await db.updateTracked(id, { isActive: false }))) throw notFound('tracked option', id);
  res.status(204).end();
});

// Validated observations only (success / retried), oldest first.
router.get('/tracked/:id/history', async (req, res) => {
  const tracked = await findTracked(req.params.id);
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 1000, fallback: 500 });
  const rows = await db.listObservations(tracked.id, limit);
  res.json({
    trackedId: tracked.id,
    observations: rows.map(row => ({ observedAt: row.finished_at, price: num(row.price), currency: row.currency, stock: row.stock, outcome: row.outcome })),
  });
});

// The scrape log: every attempt, failed ones included, newest first.
router.get('/tracked/:id/attempts', async (req, res) => {
  const tracked = await findTracked(req.params.id);
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 500, fallback: 100 });
  res.json({ trackedId: tracked.id, attempts: (await db.listAttempts(tracked.id, limit)).map(attemptJson) });
});

// Manual scrape of one option. Answers 202 at once; the scrape runs in the background on the shared runner.
router.post('/tracked/:id/scrape', async (req, res) => {
  const tracked = await findTracked(req.params.id);
  if (!tracked.is_active) throw new HttpError(409, 'not_active', 'This option is not being tracked');
  await refuseIfRunning();
  if (!(await db.claimManualScrape(tracked.id, config.manualScrapeCooldownMinutes))) {
    const readyAt = new Date(tracked.last_manual_scrape_at).getTime() + config.manualScrapeCooldownMinutes * 60_000;
    throw new HttpError(429, 'cooldown', `This option was scraped manually less than ${config.manualScrapeCooldownMinutes} minutes ago`, {
      retryAfterSeconds: Math.max(1, Math.ceil((readyAt - Date.now()) / 1000)),
    });
  }
  const started = await startTick({ trigger: 'manual', trackedIds: [tracked.id], log });
  if (started.status === 'busy') await refuseIfRunning();
  res.status(202).json({ status: 'started', runId: started.runId });
});

// ---- scheduled runs -------------------------------------------------------------

// Called by the external cron. Scrapes the options that are due; { "force": true } scrapes every active option.
router.post('/scrape/run', requireSecret, async (req, res) => {
  const force = objectBody(req.body ?? {}, ['force']).force === true;
  await refuseIfRunning();
  const started = await startTick({ trigger: force ? 'manual' : 'cron', force, log });
  if (started.status === 'busy') await refuseIfRunning();
  res.status(202).json({ status: 'started', runId: started.runId });
});

router.get('/runs', async (req, res) => {
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 100, fallback: 20 });
  res.json({ runs: (await db.listRuns(limit)).map(runJson) });
});

router.get('/runs/:id', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  const run = await db.getRun(id);
  if (!run) throw notFound('run', id);
  const attempts = await db.listRunAttempts(id);
  res.json({
    run: runJson(run),
    attempts: attempts.map(row => ({
      id: row.id,
      trackedId: row.tracked_product_id,
      storeProductId: row.store_product_id,
      productName: row.product_name,
      optionLabel: row.option_label,
      outcome: row.outcome,
      price: num(row.price),
      currency: row.currency,
      stock: row.stock,
      tries: row.tries,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  });
});

// ---- alerts and layout ------------------------------------------------------------

router.get('/alerts', async (req, res) => {
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 200, fallback: 50 });
  const rows = await db.listAlerts({ unreadOnly: req.query.unread === 'true', limit });
  res.json({ alerts: rows.map(alertJson) });
});

router.post('/alerts/read-all', async (_req, res) => {
  res.json({ updated: await db.markAllAlertsRead() });
});

router.post('/alerts/:id/read', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  const alert = await db.markAlertRead(id);
  if (!alert) throw notFound('alert', id);
  res.json({ alert: alertJson(alert) });
});

// Store layout versions seen by the scraper, newest first, plus structure-related alerts.
router.get('/layout', async (req, res) => {
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 100, fallback: 20 });
  const [versions, alerts] = await Promise.all([
    db.listLayoutVersions(limit),
    db.listAlerts({ unreadOnly: false, limit, types: ['structure_changed', 'store_app_updated'] }),
  ]);
  res.json({
    versions: versions.map(row => ({
      id: row.id,
      revision: row.revision,
      variant: row.variant,
      manifestHash: row.manifest_hash,
      schemaHash: row.schema_hash,
      supported: row.supported,
      bundlePath: row.bundle_path,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      seenCount: row.seen_count,
      manifest: row.manifest,
    })),
    alerts: alerts.map(alertJson),
  });
});

// ---- CSV export -----------------------------------------------------------------------

router.get('/export.csv', async (_req, res) => {
  const csv = attemptsToCsv(await db.listAttemptsForExport());
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="pricepulse-scrape-history-${stamp}.csv"`);
  res.send(csv);
});

// ---- helpers --------------------------------------------------------------------------

function requireSecret(req, _res, next) {
  if (!config.cronSecret) throw new HttpError(503, 'not_configured', 'CRON_SECRET is not set on the server');
  const given = Buffer.from(req.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${config.cronSecret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, 'unauthorized', 'Missing or wrong bearer token');
  }
  next();
}

async function refuseIfRunning() {
  const running = await db.getRunningRun();
  if (running) {
    throw new HttpError(409, 'run_in_progress', 'A scrape run is already in progress', { runningRunId: running.id, startedAt: running.started_at });
  }
}

async function findTracked(idParam) {
  const id = positiveInt(idParam, 'id');
  const tracked = await db.getTrackedOverview(id);
  if (!tracked) throw notFound('tracked option', id);
  return tracked;
}

const notFound = (what, id) => new HttpError(404, 'not_found', `No ${what} with id ${id}`);

function objectBody(body, allowedKeys) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_request', 'Body must be a JSON object');
  const unknown = Object.keys(body).filter(key => !allowedKeys.includes(key));
  if (unknown.length) throw new HttpError(400, 'invalid_request', `Unknown field(s): ${unknown.join(', ')}`);
  return body;
}

// Accepts a JSON number or a digits-only string (path parameters are strings).
function positiveInt(value, name) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number <= 0) throw new HttpError(400, 'invalid_request', `${name} must be a positive integer`);
  return number;
}

function queryInt(value, name, { min, max, fallback }) {
  if (value === undefined) return fallback;
  const number = /^\d+$/.test(String(value)) ? Number(value) : NaN;
  if (!(number >= min && number <= max)) throw new HttpError(400, 'invalid_request', `${name} must be an integer from ${min} to ${max}`);
  return number;
}

function optionIdValue(value) {
  if (typeof value !== 'string' || !/^o\d{1,2}$/.test(value)) throw new HttpError(400, 'invalid_request', 'optionId must look like "o1"');
  return value;
}

function intervalValue(value) {
  if (!SCRAPE_INTERVALS.includes(value)) {
    throw new HttpError(400, 'invalid_request', `scrapeIntervalMinutes must be one of ${SCRAPE_INTERVALS.join(', ')}`);
  }
  return value;
}

function thresholdValue(value) {
  if (typeof value !== 'number' || !(value >= 0.5 && value <= 90)) {
    throw new HttpError(400, 'invalid_request', 'priceDropThresholdPct must be a number from 0.5 to 90');
  }
  return value;
}

// ---- JSON shapes ------------------------------------------------------------------------

// numeric columns arrive from pg as strings; prices are sent as numbers.
const num = value => (value === null || value === undefined ? null : Number(value));
const productUrl = storeProductId => `${config.storeBaseUrl}/item/${storeProductId}`;

function trackedJson(row) {
  return {
    id: row.id,
    storeProductId: row.store_product_id,
    productUrl: productUrl(row.store_product_id),
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    sku: row.sku,
    description: row.description,
    optionAxis: row.option_axis,
    optionId: row.option_id,
    optionLabel: row.option_label,
    options: row.options,
    specs: row.specs,
    reviewSummary: row.review_summary,
    isActive: row.is_active,
    scrapeIntervalMinutes: row.scrape_interval_minutes,
    nextScrapeAt: row.next_scrape_at,
    priceDropThresholdPct: num(row.price_drop_threshold_pct),
    lastManualScrapeAt: row.last_manual_scrape_at,
    createdAt: row.created_at,
    latest: row.latest_at
      ? {
          price: num(row.latest_price),
          currency: row.latest_currency,
          stock: row.latest_stock,
          observedAt: row.latest_at,
          mrp: row.latest_extras?.mrp ?? null,
          memberPrice: row.latest_extras?.memberPrice ?? null,
        }
      : null,
    previous: row.previous_at ? { price: num(row.previous_price), stock: row.previous_stock, observedAt: row.previous_at } : null,
    lastAttempt: row.last_attempt_at
      ? { outcome: row.last_attempt_outcome, finishedAt: row.last_attempt_at, errorCode: row.last_attempt_error }
      : null,
  };
}

function attemptJson(row) {
  return {
    id: row.id,
    runId: row.run_id,
    trigger: row.trigger,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    outcome: row.outcome, // null while the attempt is still running
    price: num(row.price),
    currency: row.currency,
    stock: row.stock,
    tries: row.tries,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    layoutRevision: row.layout_revision,
    tryLog: row.details?.tries ?? [],
  };
}

function runJson(row) {
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.started_at,
    heartbeatAt: row.heartbeat_at,
    finishedAt: row.finished_at,
    productsDue: row.products_due,
    success: row.success_count,
    retried: row.retried_count,
    failed: row.failed_count,
    errorMessage: row.error_message,
    faultInjected: row.fault_injection !== null,
  };
}

function alertJson(row) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    trackedId: row.tracked_product_id,
    attemptId: row.attempt_id,
    title: row.title,
    message: row.message,
    data: row.data,
    createdAt: row.created_at,
    readAt: row.read_at,
    emailStatus: row.email_status,
  };
}
