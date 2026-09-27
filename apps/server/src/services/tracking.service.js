// Starting to track a product option. Used by POST /api/tracked and `pnpm scrape -- --track`.
import { upsertProduct } from '../db/repositories/products.repository.js';
import { addTrackedProduct } from '../db/repositories/tracked-products.repository.js';
import { DEFAULT_INTERVAL, SCRAPE_INTERVALS } from '../scheduler/schedule.js';
import { ScrapeError } from '../scraper/retry.js';
import { getItem } from '../scraper/store.js';

// Starts tracking an option after checking it against the store. Re-tracking re-activates the same row.
export async function trackOption(productId, optionId, settings) {
  return (await trackOptions(productId, [optionId], settings))[0];
}

// Several options of one product: every option is checked against the store (one lookup) before any is stored, so
// an unknown option leaves nothing tracked.
export async function trackOptions(productId, optionIds, { intervalMinutes = DEFAULT_INTERVAL, thresholdPct } = {}) {
  if (!SCRAPE_INTERVALS.includes(intervalMinutes)) {
    throw new Error(`interval must be one of ${SCRAPE_INTERVALS.join(', ')} minutes, got ${intervalMinutes}`);
  }
  const item = await getItem(productId);
  const options = optionIds.map(optionId => {
    const option = item.options.find(o => o.id === optionId);
    if (!option) throw new ScrapeError('option_not_found', `product ${productId} has no option ${optionId}`);
    return option;
  });
  await upsertProduct(item);
  const rows = [];
  for (const option of options) {
    rows.push(await addTrackedProduct({ storeProductId: productId, optionId: option.id, optionLabel: option.label, intervalMinutes, thresholdPct }));
  }
  return rows;
}
