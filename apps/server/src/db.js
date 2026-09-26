// PostgreSQL access: one small pool and one plain function per query. No ORM.
// timestamptz columns come back as JS Dates (absolute instants), so the session time zone never matters.
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';
import { DEFAULT_INTERVAL } from './schedule.js';

// Our bigint ids are far below 2^53, so read them as numbers rather than strings.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'db', 'migrations');
let pool;

// TLS follows the URL's sslmode (e.g. ?sslmode=require for Supabase); a local URL without it connects in plain text.
function getPool() {
  if (!pool) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 3 });
  }
  return pool;
}

const query = (text, params) => getPool().query(text, params);
const json = value => (value === undefined || value === null ? null : JSON.stringify(value));

export async function closeDb() {
  await pool?.end();
  pool = undefined;
}

// ---- migrations -------------------------------------------------------------

// Applies db/migrations/*.sql in filename order, each once and in its own transaction.
export async function migrate(dir = MIGRATIONS_DIR) {
  await query('create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())');
  const applied = new Set((await query('select filename from schema_migrations')).rows.map(row => row.filename));
  const pending = readdirSync(dir).filter(file => file.endsWith('.sql')).sort().filter(file => !applied.has(file));
  for (const file of pending) {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('insert into schema_migrations (filename) values ($1)', [file]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw new Error(`migration ${file} failed: ${error.message}`, { cause: error });
    } finally {
      client.release();
    }
  }
  return pending;
}

// ---- products ---------------------------------------------------------------

// Listing rows from the catalogue sync. Leaves the detail columns (options, specs, reviews) untouched.
export async function upsertCatalogProducts(products) {
  await query(
    `insert into products (store_product_id, name, slug, brand, category, sku, description, catalog_synced_at)
     select id, name, slug, brand, category, sku, description, now()
     from jsonb_to_recordset($1::jsonb) as x(id int, name text, slug text, brand text, category text, sku text, description text)
     on conflict (store_product_id) do update set
       name = excluded.name, slug = excluded.slug, brand = excluded.brand, category = excluded.category,
       sku = excluded.sku, description = excluded.description, catalog_synced_at = now()`,
    [JSON.stringify(products)],
  );
}

// Only products seen by a catalogue sync count; products added through a detail lookup have no sync time.
export async function catalogStatus() {
  const { rows } = await query(
    'select count(catalog_synced_at)::int as count, max(catalog_synced_at) as synced_at from products',
  );
  return rows[0];
}

// Case-insensitive search on product names: every word must appear; names starting with the query come first.
export async function searchProducts(text, limit) {
  const words = text.trim().split(/\s+/).map(word => `%${word.replace(/[\\%_]/g, '\\$&')}%`);
  const conditions = words.map((_, i) => `name ilike $${i + 3}`).join(' and ');
  const { rows } = await query(
    `select store_product_id, name, brand, category, sku from products
     where ${conditions}
     order by (lower(name) like lower($1) || '%') desc, name
     limit $2`,
    [text.trim().replace(/[\\%_]/g, '\\$&'), limit, ...words],
  );
  return rows;
}

export function reviewSummary(reviews = []) {
  const ratings = reviews.map(review => review.rating).filter(Number.isFinite);
  if (!ratings.length) return null;
  return { count: ratings.length, avgRating: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 };
}

export async function upsertProduct(item) {
  await query(
    `insert into products (store_product_id, name, slug, brand, category, sku, description, option_axis, options, specs,
                           review_summary, details_fetched_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
     on conflict (store_product_id) do update set
       name = excluded.name, slug = excluded.slug, brand = excluded.brand, category = excluded.category,
       sku = excluded.sku, description = excluded.description, option_axis = excluded.option_axis,
       options = excluded.options, specs = excluded.specs, review_summary = excluded.review_summary,
       details_fetched_at = now()`,
    [item.id, item.name, item.slug, item.brand, item.category, item.sku, item.description, item.optionAxis,
      json(item.options), json(item.specs), json(reviewSummary(item.reviews))],
  );
}

// ---- tracked products -------------------------------------------------------

const TRACKED_WITH_PRODUCT = `
  select t.*, p.name as product_name, p.option_axis
  from tracked_products t join products p using (store_product_id)`;

// Tracking an option that was tracked before re-activates the same row, so its history continues.
// `created` is false for a re-activation (xmax = 0 only for a freshly inserted row).
export async function addTrackedProduct({ storeProductId, optionId, optionLabel, intervalMinutes = DEFAULT_INTERVAL, thresholdPct }) {
  const { rows } = await query(
    `insert into tracked_products (store_product_id, option_id, option_label, scrape_interval_minutes, price_drop_threshold_pct)
     values ($1, $2, $3, $4, coalesce($5::numeric, 5))
     on conflict (store_product_id, option_id) do update set is_active = true, option_label = excluded.option_label, updated_at = now()
     returning *, (xmax = 0) as created`,
    [storeProductId, optionId, optionLabel, intervalMinutes, thresholdPct ?? null],
  );
  return rows[0];
}

export async function countActiveTracked() {
  return (await query('select count(*)::int as n from tracked_products where is_active')).rows[0].n;
}

export async function listActiveTracked() {
  return (await query(`${TRACKED_WITH_PRODUCT} where t.is_active order by t.store_product_id, t.option_id`)).rows;
}

export async function getTrackedByIds(ids) {
  return (await query(`${TRACKED_WITH_PRODUCT} where t.id = any($1) order by t.store_product_id, t.option_id`, [ids])).rows;
}

export async function setNextScrapeAt(trackedId, at) {
  await query('update tracked_products set next_scrape_at = $2, updated_at = now() where id = $1', [trackedId, at]);
}

// Only the fields passed (not undefined) change. Returns the updated row, or undefined when the id does not exist.
export async function updateTracked(trackedId, { intervalMinutes, thresholdPct, isActive, nextScrapeAt }) {
  const { rows } = await query(
    `update tracked_products set
       scrape_interval_minutes = coalesce($2, scrape_interval_minutes),
       price_drop_threshold_pct = coalesce($3, price_drop_threshold_pct),
       is_active = coalesce($4, is_active),
       next_scrape_at = coalesce($5, next_scrape_at),
       updated_at = now()
     where id = $1
     returning *`,
    [trackedId, intervalMinutes ?? null, thresholdPct ?? null, isActive ?? null, nextScrapeAt ?? null],
  );
  return rows[0];
}

// Atomically records a manual scrape unless one happened within the cooldown. Returns false when refused.
export async function claimManualScrape(trackedId, cooldownMinutes) {
  const { rowCount } = await query(
    `update tracked_products set last_manual_scrape_at = now()
     where id = $1 and is_active
       and (last_manual_scrape_at is null or last_manual_scrape_at < now() - make_interval(mins => $2))`,
    [trackedId, cooldownMinutes],
  );
  return rowCount === 1;
}

// Everything the dashboard shows per tracked option: product details, latest and previous validated observation,
// and the most recent attempt of any outcome.
const TRACKED_OVERVIEW = `
  select t.*, p.name as product_name, p.brand, p.category, p.sku, p.description, p.option_axis, p.options, p.specs,
         p.review_summary,
         latest.price as latest_price, latest.currency as latest_currency, latest.stock as latest_stock,
         latest.finished_at as latest_at, latest.extras as latest_extras,
         previous.price as previous_price, previous.stock as previous_stock, previous.finished_at as previous_at,
         last.outcome as last_attempt_outcome, last.finished_at as last_attempt_at, last.error_code as last_attempt_error
  from tracked_products t
  join products p using (store_product_id)
  left join lateral (
    select price, currency, stock, finished_at, extras from scrape_attempts
    where tracked_product_id = t.id and outcome in ('success', 'retried') order by finished_at desc limit 1
  ) latest on true
  left join lateral (
    select price, stock, finished_at from scrape_attempts
    where tracked_product_id = t.id and outcome in ('success', 'retried') order by finished_at desc offset 1 limit 1
  ) previous on true
  left join lateral (
    select outcome, finished_at, error_code from scrape_attempts
    where tracked_product_id = t.id and finished_at is not null order by finished_at desc limit 1
  ) last on true`;

export async function listTrackedOverview({ includeInactive = false } = {}) {
  return (await query(`${TRACKED_OVERVIEW} where $1 or t.is_active order by t.created_at, t.id`, [includeInactive])).rows;
}

export async function getTrackedOverview(trackedId) {
  return (await query(`${TRACKED_OVERVIEW} where t.id = $1`, [trackedId])).rows[0];
}

// ---- runs -------------------------------------------------------------------

// Returns null when another run is already 'running' (the partial unique index is the lock).
export async function startRun({ trigger, host, faultInjection = null }) {
  try {
    const { rows } = await query(
      'insert into scrape_runs (trigger, host, fault_injection) values ($1, $2, $3) returning *',
      [trigger, host, json(faultInjection)],
    );
    return rows[0];
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'scrape_runs_one_running') return null;
    throw error;
  }
}

export async function setRunProductsDue(runId, count) {
  await query('update scrape_runs set products_due = $2, heartbeat_at = now() where id = $1', [runId, count]);
}

export async function touchRun(runId) {
  await query('update scrape_runs set heartbeat_at = now() where id = $1', [runId]);
}

export async function finishRun(runId, { status, success = 0, retried = 0, failed = 0, errorMessage = null }) {
  await query(
    `update scrape_runs set status = $2, finished_at = now(), success_count = $3, retried_count = $4,
                            failed_count = $5, error_message = $6
     where id = $1`,
    [runId, status, success, retried, failed, errorMessage],
  );
}

// A run whose heartbeat stopped (process restarted or killed) is closed as abandoned, and its unfinished
// attempts are recorded as failed, so nothing stays "in progress" forever and the lock is released.
export async function reapStaleRuns(staleMinutes) {
  const { rows } = await query(
    `update scrape_runs
     set status = 'abandoned', finished_at = now(), error_message = 'no heartbeat for ' || $1 || ' minutes; the process probably stopped'
     where status = 'running' and heartbeat_at < now() - make_interval(mins => $1)
     returning id`,
    [staleMinutes],
  );
  const runIds = rows.map(row => row.id);
  if (runIds.length) await failUnfinishedAttempts(runIds);
  return runIds;
}

export async function failUnfinishedAttempts(runIds) {
  await query(
    `update scrape_attempts
     set outcome = 'failed', finished_at = now(), error_code = 'interrupted', error_message = 'the run stopped before this attempt finished'
     where finished_at is null and run_id = any($1)`,
    [runIds],
  );
}

// ---- attempts ---------------------------------------------------------------

export async function startAttempt(runId, trackedProductId) {
  const { rows } = await query('insert into scrape_attempts (run_id, tracked_product_id) values ($1, $2) returning id', [runId, trackedProductId]);
  return rows[0].id;
}

export async function finishAttempt(attemptId, attempt) {
  await query(
    `update scrape_attempts
     set finished_at = now(), outcome = $2, price = $3, currency = $4, stock = $5, tries = $6, error_code = $7,
         error_message = $8, layout_version_id = $9, layout_revision = $10, extras = $11, details = $12
     where id = $1`,
    [attemptId, attempt.outcome, attempt.price ?? null, attempt.currency ?? null, attempt.stock ?? null, attempt.tries,
      attempt.errorCode ?? null, attempt.errorMessage ?? null, attempt.layoutVersionId ?? null, attempt.layoutRevision ?? null,
      json(attempt.extras), json(attempt.details ?? {})],
  );
}

// The scrape log: every attempt (failed ones included), newest first, with the trigger of its run.
export async function listAttempts(trackedProductId, limit = 50) {
  const { rows } = await query(
    `select a.*, r.trigger from scrape_attempts a join scrape_runs r on r.id = a.run_id
     where a.tracked_product_id = $1 order by a.started_at desc, a.id desc limit $2`,
    [trackedProductId, limit],
  );
  return rows;
}

// Price/stock history: the most recent `limit` validated observations, oldest first.
export async function listObservations(trackedProductId, limit) {
  const { rows } = await query(
    `select * from (
       select id, finished_at, price, currency, stock, outcome from scrape_attempts
       where tracked_product_id = $1 and outcome in ('success', 'retried')
       order by finished_at desc limit $2
     ) recent order by finished_at`,
    [trackedProductId, limit],
  );
  return rows;
}

// One row per finished attempt for the CSV export, oldest first. Failed attempts have null price and stock.
export async function listAttemptsForExport() {
  const { rows } = await query(
    `select t.store_product_id, p.name as product_name, t.option_label as selected_option, a.finished_at,
            a.price, a.stock, a.outcome
     from scrape_attempts a
     join tracked_products t on t.id = a.tracked_product_id
     join products p using (store_product_id)
     where a.finished_at is not null
     order by a.finished_at, a.id`,
  );
  return rows;
}

// ---- run history -------------------------------------------------------------

export async function listRuns(limit) {
  return (await query('select * from scrape_runs order by started_at desc, id desc limit $1', [limit])).rows;
}

export async function getRun(runId) {
  return (await query('select * from scrape_runs where id = $1', [runId])).rows[0];
}

export async function getRunningRun() {
  return (await query("select * from scrape_runs where status = 'running'")).rows[0];
}

export async function listRunAttempts(runId) {
  const { rows } = await query(
    `select a.id, a.tracked_product_id, a.outcome, a.price, a.currency, a.stock, a.tries, a.error_code, a.error_message,
            a.started_at, a.finished_at, t.store_product_id, t.option_label, p.name as product_name
     from scrape_attempts a
     join tracked_products t on t.id = a.tracked_product_id
     join products p using (store_product_id)
     where a.run_id = $1 order by a.id`,
    [runId],
  );
  return rows;
}

export async function appliedMigrations() {
  return (await query('select filename from schema_migrations order by filename')).rows.map(row => row.filename);
}

// ---- layout versions --------------------------------------------------------

export async function recordLayoutVersion({ manifestHash, schemaHash, revision, variant, bundlePath = null, manifest, supported }) {
  const { rows } = await query(
    `insert into layout_versions (manifest_hash, schema_hash, revision, variant, bundle_path, manifest, supported)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (manifest_hash) do update set last_seen_at = now(), seen_count = layout_versions.seen_count + 1
     returning id`,
    [manifestHash, schemaHash, revision, variant, bundlePath, json(manifest), supported],
  );
  return rows[0].id;
}

export async function listLayoutVersions(limit) {
  return (await query('select * from layout_versions order by last_seen_at desc, id desc limit $1', [limit])).rows;
}

// ---- alerts -----------------------------------------------------------------

// Returns null when the same event (type + dedupe key) was already alerted.
export async function insertAlert({ type, severity, trackedProductId = null, attemptId = null, dedupeKey, title, message, data = null }) {
  const { rows } = await query(
    `insert into alerts (type, severity, tracked_product_id, attempt_id, dedupe_key, title, message, data)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (type, dedupe_key) do nothing
     returning *`,
    [type, severity, trackedProductId, attemptId, dedupeKey, title, message, json(data)],
  );
  return rows[0] ?? null;
}

// types: optional list of alert types to keep (null = all).
export async function listAlerts({ unreadOnly, limit, types = null }) {
  const { rows } = await query(
    `select * from alerts
     where (not $1 or read_at is null) and ($3::text[] is null or type = any($3))
     order by created_at desc, id desc limit $2`,
    [unreadOnly, limit, types],
  );
  return rows;
}

// Returns the alert, or undefined when it does not exist. Marking an already-read alert keeps its first read time.
export async function markAlertRead(alertId) {
  const { rows } = await query('update alerts set read_at = coalesce(read_at, now()) where id = $1 returning *', [alertId]);
  return rows[0];
}

export async function markAllAlertsRead() {
  return (await query('update alerts set read_at = now() where read_at is null')).rowCount;
}
