// alerts: in-app alerts, each event alerted once (type + dedupe key).
import { json, query } from '../client.js';

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
