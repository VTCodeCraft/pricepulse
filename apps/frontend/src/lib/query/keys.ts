// Every React Query key in one place, so a mutation can invalidate exactly what it changed.
// Attempt logs sit under `tracked`, so invalidating the tracked list refreshes them too.
export const queryKeys = {
  tracked: ['tracked'] as const,
  attempts: (trackedId: number) => ['tracked', trackedId, 'attempts'] as const,
  catalogSearch: (query: string) => ['catalog', 'search', query] as const,
  product: (storeProductId: number) => ['catalog', 'product', storeProductId] as const,
};
