// Every React Query key in one place, so a mutation can invalidate exactly what it changed.
// Everything about tracked options (the lists, each option's history and scrape log) sits under `tracked`, so
// invalidating it after a scrape or a tracking change refreshes all of them.
export const queryKeys = {
  tracked: ['tracked'] as const,
  trackedIncludingInactive: ['tracked', 'including-inactive'] as const,
  history: (trackedId: number) => ['tracked', trackedId, 'history'] as const,
  attempts: (trackedId: number, limit: number) => ['tracked', trackedId, 'attempts', limit] as const,
  run: (runId: number) => ['runs', runId] as const,
  catalogSearch: (query: string) => ['catalog', 'search', query] as const,
  catalogPage: (query: string, page: number) => ['catalog', 'list', query, page] as const,
  product: (storeProductId: number) => ['catalog', 'product', storeProductId] as const,
  health: ['health'] as const,
  alerts: ['alerts'] as const,
};
