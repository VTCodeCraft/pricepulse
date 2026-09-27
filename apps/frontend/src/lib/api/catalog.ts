import type { CatalogSearch, Product } from '../../types/product';
import { api } from './client';

// Every word must appear in the product name. 503 `catalog_syncing` while the catalogue loads for the first time.
export async function searchCatalog(query: string, limit: number): Promise<CatalogSearch> {
  const { data } = await api.get<CatalogSearch>('/catalog/search', { params: { q: query, limit } });
  return data;
}

// Live from the store, so the options are current. 404 `product_not_found`, 502 `store_unavailable`.
export async function getProduct(storeProductId: number): Promise<Product> {
  const { data } = await api.get<Product>(`/catalog/products/${storeProductId}`);
  return data;
}
