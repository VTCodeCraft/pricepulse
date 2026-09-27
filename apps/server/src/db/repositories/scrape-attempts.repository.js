// scrape_attempts: one row per option per run, the single record of every scrape.
// History, the scrape log, the CSV export and alerts all read from here.
import { json, query } from '../client.js';

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

export async function failUnfinishedAttempts(runIds) {
  await query(
    `update scrape_attempts
     set outcome = 'failed', finished_at = now(), error_code = 'interrupted', error_message = 'the run stopped before this attempt finished'
     where finished_at is null and run_id = any($1)`,
    [runIds],
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

// The newest validated observation of an option, or undefined. Failed attempts are never an observation.
export async function latestObservation(trackedProductId) {
  const { rows } = await query(
    `select id, outcome, price, currency, stock, finished_at from scrape_attempts
     where tracked_product_id = $1 and outcome in ('success', 'retried')
     order by finished_at desc, id desc limit 1`,
    [trackedProductId],
  );
  return rows[0];
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
