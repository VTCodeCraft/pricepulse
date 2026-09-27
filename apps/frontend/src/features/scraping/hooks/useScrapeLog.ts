import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getRun } from '../../../lib/api/runs';
import { listAttempts, listTracked } from '../../../lib/api/tracked';
import { queryKeys } from '../../../lib/query/keys';
import { ATTEMPT_LOG_LIMIT, mergeLogs, toLogEntries, type LogEntry, type LogOption } from '../scrapeLog';

// The same query serves the product page (one option) and the Scrape Logs page (every option), so they share a cache.
const attemptLogQuery = (item: LogOption) => ({
  queryKey: queryKeys.attempts(item.id, ATTEMPT_LOG_LIMIT),
  queryFn: async () => toLogEntries(item, await listAttempts(item.id, ATTEMPT_LOG_LIMIT)),
});

export function useAttemptLog(item: LogOption) {
  return useQuery(attemptLogQuery(item));
}

// Every option's log, untracked options included, fetched when the page opens (no polling).
export function useScrapeLog() {
  const tracked = useQuery({ queryKey: queryKeys.trackedIncludingInactive, queryFn: () => listTracked({ includeInactive: true }) });
  const logs = useQueries({ queries: (tracked.data ?? []).map(attemptLogQuery), combine: combineLogs });
  return { tracked, ...logs };
}

// Defined once so React Query can keep the merged log between renders.
// A failed refresh of a log that is already loaded keeps showing it; only logs with no data count as failed.
function combineLogs(results: UseQueryResult<LogEntry[]>[]) {
  const failed = results.filter(result => result.isError && !result.data);
  return {
    entries: mergeLogs(results.map(result => result.data ?? [])),
    isPending: results.some(result => result.isPending),
    failedCount: failed.length,
    allFailed: failed.length > 0 && failed.length === results.length,
    // Options whose log came back full: their older attempts are only in the CSV export.
    cutCount: results.filter(result => result.data?.length === ATTEMPT_LOG_LIMIT).length,
    retryFailed: () => Promise.all(failed.map(result => result.refetch())),
  };
}

export function useRun(runId: number) {
  return useQuery({ queryKey: queryKeys.run(runId), queryFn: () => getRun(runId) });
}
