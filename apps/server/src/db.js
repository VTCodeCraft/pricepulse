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

export async function upsertProduct(item) {
  const ratings = (item.reviews ?? []).map(review => review.rating).filter(Number.isFinite);
  const reviewSummary = ratings.length
    ? { count: ratings.length, avgRating: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 }
    : null;
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
      json(item.options), json(item.specs), json(reviewSummary)],
  );
}

// ---- tracked products -------------------------------------------------------

const TRACKED_WITH_PRODUCT = `
  select t.*, p.name as product_name, p.option_axis
  from tracked_products t join products p using (store_product_id)`;

// Tracking an option that was tracked before re-activates the same row, so its history continues.
export async function addTrackedProduct({ storeProductId, optionId, optionLabel, intervalMinutes = DEFAULT_INTERVAL }) {
  const { rows } = await query(
    `insert into tracked_products (store_product_id, option_id, option_label, scrape_interval_minutes)
     values ($1, $2, $3, $4)
     on conflict (store_product_id, option_id) do update set is_active = true, option_label = excluded.option_label, updated_at = now()
     returning *`,
    [storeProductId, optionId, optionLabel, intervalMinutes],
  );
  return rows[0];
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

export async function setScrapeInterval(trackedId, intervalMinutes, nextScrapeAt) {
  await query(
    'update tracked_products set scrape_interval_minutes = $2, next_scrape_at = $3, updated_at = now() where id = $1',
    [trackedId, intervalMinutes, nextScrapeAt],
  );
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

export async function listAttempts(trackedProductId, limit = 50) {
  const { rows } = await query(
    'select * from scrape_attempts where tracked_product_id = $1 order by started_at desc, id desc limit $2',
    [trackedProductId, limit],
  );
  return rows;
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
