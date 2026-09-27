// tracked_products: the options being tracked, their schedule, and the dashboard overview of each.
import { DEFAULT_INTERVAL } from '../../scheduler/schedule.js';
import { query } from '../client.js';

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
