import { useQueries } from '@tanstack/react-query';
import { subHours } from 'date-fns';
import { listAttempts } from '../../../lib/api/tracked';
import { queryKeys } from '../../../lib/query/keys';
import { useTrackedProducts } from '../../products/hooks/useTrackedProducts';
import { mergeLogs, toLogEntries } from '../../scraping/scrapeLog';
import { attemptCountsSince } from '../kpis';

const LOG_LIMIT = 100; // per option; a day holds at most 24 scheduled attempts plus manual ones

// Attempt outcomes of the last 24 hours across the tracked options, counted from each option's scrape log.
// (Run counters are not used: a run cut off by a crash never records its counts.)
export function useScrapeCounts() {
  const tracked = useTrackedProducts();
  return useQueries({
    queries: (tracked.data ?? []).map(item => ({
      queryKey: queryKeys.attempts(item.id, LOG_LIMIT),
      queryFn: () => listAttempts(item.id, LOG_LIMIT),
    })),
    combine: results => ({
      isPending: tracked.isPending || results.some(result => result.isPending),
      isError: tracked.isError || results.some(result => result.isError),
      refetch: () => (tracked.isError ? tracked.refetch() : Promise.all(results.map(result => result.refetch()))),
      data: results.every(result => result.data)
        ? attemptCountsSince(results.map(result => result.data ?? []), subHours(new Date(), 24), LOG_LIMIT)
        : undefined,
    }),
  });
}

// The newest attempts across the tracked options, from the same queries (and cache) as the counts above.
export function useRecentAttempts(count: number) {
  const tracked = useTrackedProducts();
  const items = tracked.data ?? [];
  return useQueries({
    queries: items.map(item => ({
      queryKey: queryKeys.attempts(item.id, LOG_LIMIT),
      queryFn: () => listAttempts(item.id, LOG_LIMIT),
    })),
    combine: results => ({
      isPending: tracked.isPending || results.some(result => result.isPending),
      isError: tracked.isError || results.some(result => result.isError),
      entries: mergeLogs(results.map((result, i) => toLogEntries(items[i], result.data ?? []))).slice(0, count),
    }),
  });
}
