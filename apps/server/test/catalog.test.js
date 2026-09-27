import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncCatalog } from '../src/services/catalog.service.js';
import * as products from '../src/db/repositories/products.repository.js';
import { ScrapeError } from '../src/scraper/retry.js';
import * as store from '../src/scraper/store.js';

vi.mock('../src/scraper/store.js', () => ({ getListingPage: vi.fn(), getItem: vi.fn() }));
vi.mock('../src/db/repositories/products.repository.js', () => ({ upsertCatalogProducts: vi.fn() }));

const product = id => ({ id, name: `Product ${id}`, slug: `p-${id}`, brand: 'B', category: 'C', sku: `SK-${id}`, description: '' });
const page = ids => ({ page: 1, perPage: ids.length, totalPages: 2, count: 5, results: ids.map(product) });

describe('syncCatalog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps reading shuffled pages until every product has been seen', async () => {
    store.getListingPage.mockResolvedValueOnce(page([2001, 2003])).mockResolvedValueOnce(page([2003, 2002])).mockResolvedValueOnce(page([2005, 2004]));
    expect(await syncCatalog()).toEqual({ stored: 5, count: 5 });
    expect(store.getListingPage).toHaveBeenCalledTimes(3);
    expect(store.getItem).not.toHaveBeenCalled();
    expect(products.upsertCatalogProducts.mock.calls[0][0].map(p => p.id).sort()).toEqual([2001, 2002, 2003, 2004, 2005]);
  });

  it('fetches products the pages never showed by id', async () => {
    store.getListingPage.mockResolvedValue(page([2001, 2002, 2005]));
    store.getItem.mockImplementation(async id => {
      if (id === 2003) return product(2003);
      throw new ScrapeError('product_not_found', `product ${id} does not exist`);
    });
    expect(await syncCatalog({ maxPages: 3 })).toEqual({ stored: 4, count: 5 });
    expect(store.getItem.mock.calls.map(([id]) => id)).toEqual([2003, 2004]);
  });

  it('stops on a store failure instead of saving a partial catalogue', async () => {
    store.getListingPage.mockRejectedValue(new ScrapeError('store_http_error', 'GET /api/v2/listings returned 503'));
    await expect(syncCatalog()).rejects.toMatchObject({ code: 'store_http_error' });
    expect(products.upsertCatalogProducts).not.toHaveBeenCalled();
  });
});
