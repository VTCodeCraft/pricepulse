import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api/client';
import { getProduct, searchCatalog } from '../../../lib/api/catalog';
import { queryKeys } from '../../../lib/query/keys';
import { SEARCH_LIMIT } from '../search';

const FIVE_MINUTES = 5 * 60_000;

// `query` is already normalised (see searchQuery); null means "do not search".
export function useCatalogSearch(query: string | null) {
  return useQuery({
    queryKey: queryKeys.catalogSearch(query ?? ''),
    queryFn: () => searchCatalog(query ?? '', SEARCH_LIMIT),
    enabled: query !== null,
    staleTime: FIVE_MINUTES,
  });
}

// Product details come live from the store, so they are kept for a few minutes rather than asked for on every visit.
export function useProduct(storeProductId: number | null) {
  return useQuery({
    queryKey: queryKeys.product(storeProductId ?? 0),
    queryFn: () => getProduct(storeProductId ?? 0),
    enabled: storeProductId !== null,
    staleTime: FIVE_MINUTES,
    retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.status === 404),
  });
}
