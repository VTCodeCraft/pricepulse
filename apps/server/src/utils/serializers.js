// Database rows → API JSON (camelCase, prices as numbers).
import { config } from '../config.js';

// numeric columns arrive from pg as strings; prices are sent as numbers.
export const num = value => (value === null || value === undefined ? null : Number(value));
export const productUrl = storeProductId => `${config.storeBaseUrl}/item/${storeProductId}`;

export function trackedJson(row) {
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

export function attemptJson(row) {
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

export function runJson(row) {
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

// An attempt as listed under its run (GET /api/runs/:id).
export function runAttemptJson(row) {
  return {
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
  };
}

export function layoutVersionJson(row) {
  return {
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
  };
}

export function alertJson(row) {
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
