// scrape_runs: one row per run. The partial unique index on status = 'running' is the run lock.
import { json, query } from '../client.js';
import { failUnfinishedAttempts } from './scrape-attempts.repository.js';

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
