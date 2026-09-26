// Contract values agreed in the implementation plan. Pure data, no runtime dependencies.
// apps/server keeps its own copy of what it needs so it stays independently deployable.

export const SCRAPE_OUTCOMES = Object.freeze(['success', 'retried', 'failed']);

export const DEFAULT_SCRAPE_INTERVAL_MINUTES = 120;
export const SCRAPE_INTERVAL_MINUTES = Object.freeze([60, 120, 240, 360, 720, 1440]);

export const CSV_COLUMNS = Object.freeze([
  'store_product_id',
  'product_name',
  'selected_option',
  'timestamp',
  'price',
  'stock',
  'outcome',
]);
