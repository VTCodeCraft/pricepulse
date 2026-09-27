import { ApiError } from '../../lib/api/client';
import type { CatalogSearch } from '../../types/product';

export const SEARCH_LIMIT = 20;

// The backend accepts 2 to 100 characters after trimming. Collapsing spaces keeps "halvard  tablet " and
// "halvard tablet" on the same cached query.
export function searchQuery(raw: string): string | null {
  const query = raw.trim().replace(/\s+/g, ' ');
  return query.length >= 2 && query.length <= 100 ? query : null;
}

export type SearchView = 'hint' | 'loading' | 'syncing' | 'error' | 'empty' | 'results';

// What the search panel shows. While the debounce is pending the previous results are hidden, not left on screen.
export function searchView(
  typed: string | null,
  searched: string | null,
  result: { isPending: boolean; isError: boolean; error: Error | null; data?: CatalogSearch },
): SearchView {
  if (typed === null) return 'hint';
  if (typed !== searched) return 'loading';
  if (result.isError) return result.error instanceof ApiError && result.error.code === 'catalog_syncing' ? 'syncing' : 'error';
  if (result.isPending || !result.data) return 'loading';
  return result.data.results.length ? 'results' : 'empty';
}
