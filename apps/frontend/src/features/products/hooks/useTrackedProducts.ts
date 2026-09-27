import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../../lib/api/client';
import { getRun } from '../../../lib/api/runs';
import { listTracked, scrapeTracked, track, untrack } from '../../../lib/api/tracked';
import { queryKeys } from '../../../lib/query/keys';
import { formatPrice } from '../../../lib/utils/format';
import type { TrackedProduct } from '../../../types/product';
import type { RunDetail } from '../../../types/scrape';

export function useTrackedProducts() {
  return useQuery({ queryKey: queryKeys.tracked, queryFn: listTracked });
}

// Tracking a new option also starts its first scrape in the background; the list is refreshed again when that
// run finishes, so the first price appears without a reload.
export function useTrackProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: track,
    onSuccess: ({ initialRun }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tracked });
      if (initialRun?.status === 'started') {
        waitForRun(initialRun.runId).then(
          () => queryClient.invalidateQueries({ queryKey: queryKeys.tracked }),
          () => {}, // a failed or slow first scrape still shows up in the list on the next refresh
        );
      }
    },
  });
}

export function useUntrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: TrackedProduct) => untrack(item.id),
    onSuccess: (_, item) => toast.success(`Stopped tracking ${item.productName} · ${item.optionLabel}`),
    onError: error => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tracked }),
  });
}

// POST /tracked/:id/scrape answers 202 and scrapes in the background. The mutation stays pending until that run
// finishes (polling only this run), then reports the real result.
export function useRefreshPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: TrackedProduct) => {
      const { runId } = await scrapeTracked(item.id);
      toast.info(`Price refresh started for ${item.productName}`);
      return waitForRun(runId);
    },
    onSuccess: ({ attempts }, item) => {
      const attempt = attempts.find(a => a.trackedId === item.id);
      if (attempt?.price != null && attempt.outcome !== 'failed') {
        toast.success(`${item.productName}: ${formatPrice(attempt.price, attempt.currency ?? undefined)}`);
      } else {
        toast.error(`${item.productName}: the refresh failed${attempt?.errorCode ? ` (${attempt.errorCode})` : ''}`);
      }
    },
    onError: error => toast.error(refreshErrorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tracked }),
  });
}

const POLL_MS = 3_000;
const POLL_LIMIT = 200; // 10 minutes; one option takes 20–60 s, at most about 6.5 min with every retry

async function waitForRun(runId: number): Promise<RunDetail> {
  for (let i = 0; i < POLL_LIMIT; i++) {
    const detail = await getRun(runId);
    if (detail.run.status !== 'running') return detail;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  throw new ApiError(0, 'still_running', 'The refresh is still running; its result will appear in the scrape log');
}

function refreshErrorMessage(error: Error): string {
  if (!(error instanceof ApiError)) return error.message;
  if (error.code === 'run_in_progress') return 'Another scrape is running. Try again in a minute.';
  if (error.code === 'cooldown') {
    const seconds = Number(error.details?.retryAfterSeconds) || 0;
    return `Refreshed less than 10 minutes ago. Try again in ${Math.max(1, Math.ceil(seconds / 60))} min.`;
  }
  return error.message;
}
