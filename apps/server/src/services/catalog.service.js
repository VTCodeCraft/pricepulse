// Builds the searchable product list. The store has no search, and every listing request returns a freshly
// shuffled page, so we keep asking for pages until every product has been seen, then fetch any stragglers by id.
import { upsertCatalogProducts } from '../db/repositories/products.repository.js';
import { getItem, getListingPage } from '../scraper/store.js';

const PAGE_SIZE = 60; // the store caps page size at 60
let running = null;

// Starts a sync in the background unless one is already running. Returns false when one is.
export function startCatalogSync({ log = () => {} } = {}) {
  if (running) return false;
  running = syncCatalog({ log })
    .catch(error => log(`catalog sync failed: ${error.message}`))
    .finally(() => { running = null; });
  return true;
}

export const isCatalogSyncing = () => running !== null;

export async function syncCatalog({ maxPages = 80, log = () => {} } = {}) {
  const seen = new Map();
  let count = Infinity;
  let totalPages = 1;
  for (let page = 0; page < maxPages && seen.size < count; page++) {
    const listing = await getListingPage((page % totalPages) + 1, PAGE_SIZE);
    ({ count, totalPages } = listing);
    for (const product of listing.results) seen.set(product.id, product);
  }

  // Product ids are contiguous in this store (2001–2960, see docs/store-notes.md), so any gap is a product
  // the random pages never showed: fetch it directly.
  if (seen.size < count) {
    const ids = [...seen.keys()];
    for (let id = Math.min(...ids); id <= Math.max(...ids) && seen.size < count; id++) {
      if (seen.has(id)) continue;
      try {
        seen.set(id, await getItem(id));
      } catch (error) {
        if (error.code !== 'product_not_found') throw error;
      }
    }
  }

  await upsertCatalogProducts([...seen.values()]);
  log(`catalog sync: ${seen.size} of ${count} products stored`);
  return { stored: seen.size, count };
}
