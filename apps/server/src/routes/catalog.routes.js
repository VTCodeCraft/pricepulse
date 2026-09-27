import { Router } from 'express';
import { catalogStatus, reviewSummary, searchProducts, upsertProduct } from '../db/repositories/products.repository.js';
import { requireSecret } from '../middleware/require-secret.js';
import { getItem } from '../scraper/store.js';
import { isCatalogSyncing, startCatalogSync } from '../services/catalog.service.js';
import { HttpError } from '../utils/http-error.js';
import { productUrl } from '../utils/serializers.js';
import { positiveInt, queryInt } from '../utils/validation.js';

export const catalogRoutes = Router();
const log = message => console.log(message);
const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

catalogRoutes.get('/catalog/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2 || q.length > 100) throw new HttpError(400, 'invalid_request', 'q must be 2 to 100 characters');
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 50, fallback: 20 });
  const catalog = await catalogStatus();
  if (catalog.count === 0) {
    startCatalogSync({ log });
    throw new HttpError(503, 'catalog_syncing', 'The product catalogue is loading; try again in about two minutes');
  }
  // Refresh a day-old catalogue in the background; searching keeps working on the current copy meanwhile.
  if (Date.now() - new Date(catalog.synced_at).getTime() > CATALOG_MAX_AGE_MS) startCatalogSync({ log });
  const results = await searchProducts(q, limit);
  res.json({
    query: q,
    catalog: { count: catalog.count, syncedAt: catalog.synced_at, syncing: isCatalogSyncing() },
    results: results.map(row => ({ storeProductId: row.store_product_id, name: row.name, brand: row.brand, category: row.category, sku: row.sku })),
  });
});

catalogRoutes.post('/catalog/sync', requireSecret, (_req, res) => {
  if (!startCatalogSync({ log })) throw new HttpError(409, 'sync_in_progress', 'A catalogue sync is already running');
  res.status(202).json({ status: 'started' });
});

// Live from the store, so the options are always current. Also refreshes the cached product details.
catalogRoutes.get('/catalog/products/:storeProductId', async (req, res) => {
  const item = await getItem(positiveInt(req.params.storeProductId, 'storeProductId'));
  await upsertProduct(item);
  res.json({
    storeProductId: item.id,
    productUrl: productUrl(item.id),
    name: item.name,
    brand: item.brand,
    category: item.category,
    sku: item.sku,
    description: item.description,
    optionAxis: item.optionAxis,
    options: item.options,
    specs: item.specs,
    reviewSummary: reviewSummary(item.reviews),
  });
});
