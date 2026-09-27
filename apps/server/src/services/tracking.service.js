// Starting to track a product option. Used by POST /api/tracked and `pnpm scrape -- --track`.
import { upsertProduct } from '../db/repositories/products.repository.js';
import { addTrackedProduct } from '../db/repositories/tracked-products.repository.js';
import { DEFAULT_INTERVAL, SCRAPE_INTERVALS } from '../scheduler/schedule.js';
import { ScrapeError } from '../scraper/retry.js';
import { getItem } from '../scraper/store.js';

// Starts tracking an option after checking it against the store. Re-tracking re-activates the same row.
export async function trackOption(productId, optionId, { intervalMinutes = DEFAULT_INTERVAL, thresholdPct } = {}) {
  if (!SCRAPE_INTERVALS.includes(intervalMinutes)) {
    throw new Error(`interval must be one of ${SCRAPE_INTERVALS.join(', ')} minutes, got ${intervalMinutes}`);
  }
  const item = await getItem(productId);
  const option = item.options.find(o => o.id === optionId);
  if (!option) throw new ScrapeError('option_not_found', `product ${productId} has no option ${optionId}`);
  await upsertProduct(item);
  return addTrackedProduct({ storeProductId: productId, optionId, optionLabel: option.label, intervalMinutes, thresholdPct });
}
