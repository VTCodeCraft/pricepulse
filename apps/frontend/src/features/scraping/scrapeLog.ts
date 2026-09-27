import type { BadgeStatus } from '../../components/common/StatusBadge';
import { formatPrice } from '../../lib/utils/format';
import { isInRange, rangeStart, type TimeRange } from '../../lib/utils/timeRange';
import type { TrackedProduct } from '../../types/product';
import type { ScrapeAttempt, ScrapeOutcome, ScrapeRun } from '../../types/scrape';

// The API has no log across all options, only GET /api/tracked/:id/attempts (newest first, at most 500) per option,
// so the log is assembled from those and filtered here.
export const ATTEMPT_LOG_LIMIT = 500;

// An attempt together with the option it belongs to.
export type LogEntry = ScrapeAttempt & {
  trackedId: number;
  storeProductId: number;
  productName: string;
  optionId: string;
  optionLabel: string;
  isTracked: boolean; // false once the option was untracked; its attempts stay in the log
};

export type LogOption = Pick<TrackedProduct, 'id' | 'storeProductId' | 'productName' | 'optionId' | 'optionLabel' | 'isActive'>;

export function toLogEntries(item: LogOption, attempts: ScrapeAttempt[]): LogEntry[] {
  const { id: trackedId, storeProductId, productName, optionId, optionLabel, isActive: isTracked } = item;
  return attempts.map(attempt => ({ ...attempt, trackedId, storeProductId, productName, optionId, optionLabel, isTracked }));
}

// When the attempt happened: when it finished, or when it started while it is still running.
export const attemptTime = (attempt: Pick<ScrapeAttempt, 'startedAt' | 'finishedAt'>) => attempt.finishedAt ?? attempt.startedAt;

export function attemptDurationMs({ startedAt, finishedAt }: Pick<ScrapeAttempt, 'startedAt' | 'finishedAt'>): number | null {
  return finishedAt === null ? null : new Date(finishedAt).getTime() - new Date(startedAt).getTime();
}

// The backend's outcome is used as is: "retried" also covers a page that needed the store's own retry or a price
// re-check within a single try, so it cannot be derived from the number of tries.
export const attemptStatus = (outcome: ScrapeOutcome | null): BadgeStatus => outcome ?? 'running';

// Only a success or retried attempt carries an observation. Failed and running ones show a dash, never 0.
export const attemptPrice = ({ price, currency }: Pick<ScrapeAttempt, 'price' | 'currency'>) =>
  price === null ? '—' : formatPrice(price, currency ?? undefined);

export function attemptStock({ stock }: Pick<ScrapeAttempt, 'stock'>): string {
  if (stock === null) return '—';
  return stock === 0 ? 'Out of stock' : `${stock} in stock`;
}

export const triesLabel = (tries: number) => `${tries} ${tries === 1 ? 'try' : 'tries'}`;

export const TRIGGER_LABELS: Record<ScrapeRun['trigger'], string> = {
  cron: 'Scheduled',
  manual: 'Manual refresh',
  initial: 'First scrape',
  cli: 'Command line',
};

// Newest first across every option.
export function mergeLogs(logs: LogEntry[][]): LogEntry[] {
  return logs.flat().sort((a, b) => new Date(attemptTime(b)).getTime() - new Date(attemptTime(a)).getTime() || b.id - a.id);
}

export type LogFilters = { trackedId: number | null; outcome: ScrapeOutcome | null; range: TimeRange; search: string };

export const NO_FILTERS: LogFilters = { trackedId: null, outcome: null, range: 'all', search: '' };

export function filterLog(entries: LogEntry[], filters: LogFilters, now: Date): LogEntry[] {
  const start = rangeStart(filters.range, now);
  const words = filters.search.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    entry =>
      (filters.trackedId === null || entry.trackedId === filters.trackedId) &&
      (filters.outcome === null || entry.outcome === filters.outcome) &&
      isInRange(attemptTime(entry), start) &&
      words.every(word => searchText(entry).includes(word)),
  );
}

const searchText = (entry: LogEntry) =>
  [entry.productName, entry.optionLabel, entry.errorCode, entry.errorMessage, `#${entry.id}`].join(' ').toLowerCase();

// Outcomes counted from a run's own attempts. The run's counters are not used: a run that was cut off (abandoned)
// never records them.
export function outcomeCounts(attempts: { outcome: ScrapeOutcome | null }[]) {
  const counts = { success: 0, retried: 0, failed: 0, running: 0 };
  for (const { outcome } of attempts) counts[outcome ?? 'running']++;
  return counts;
}
