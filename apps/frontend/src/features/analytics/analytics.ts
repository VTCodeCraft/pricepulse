import { addDays, addHours, startOfDay, startOfHour } from 'date-fns';
import { priceChangePct, stockStatus } from '../../lib/utils/observations';
import type { TrackedProduct } from '../../types/product';
import type { ScrapeOutcome } from '../../types/scrape';
import { attemptTime, outcomeCounts, type LogEntry } from '../scraping/scrapeLog';

// Every figure here is derived from API data the app already loads: the tracked options (GET /api/tracked) and each
// option's scrape log (GET /api/tracked/:id/attempts). The run counters are not used (an abandoned run never writes them).

// "Successful" counts attempts that returned a validated price (success or retried), as on the dashboard; "retried" is
// the part of it that needed a retry, as the backend classified it. Running attempts count once they finish.
export function reliability(entries: { outcome: ScrapeOutcome | null }[]) {
  const { success, retried, failed, running } = outcomeCounts(entries);
  const successful = success + retried;
  const finished = successful + failed;
  return { successful, retried, failed, running, finished, successRate: finished === 0 ? null : (successful / finished) * 100 };
}

export type AttemptBucket = { start: number; success: number; retried: number; failed: number };

const HOUR = 3_600_000;
const isFinished = (entry: LogEntry): entry is LogEntry & { outcome: ScrapeOutcome } => entry.outcome !== null;

// Finished attempts per local hour (up to two days of data) or per local day, from the bucket of the first attempt up
// to the current one. Empty buckets in between are kept; nothing is extended past now.
export function attemptsOverTime(entries: LogEntry[], now: Date): { unit: 'hour' | 'day'; buckets: AttemptBucket[] } {
  const finished = entries.filter(isFinished);
  if (finished.length === 0) return { unit: 'hour', buckets: [] };
  const first = Math.min(...finished.map(entry => new Date(attemptTime(entry)).getTime()));
  const unit = now.getTime() - first <= 48 * HOUR ? 'hour' : 'day';
  const floor = unit === 'hour' ? startOfHour : startOfDay;
  const next = unit === 'hour' ? addHours : addDays;

  const buckets = new Map<number, AttemptBucket>();
  for (let time = floor(first); time <= now; time = next(time, 1)) {
    buckets.set(time.getTime(), { start: time.getTime(), success: 0, retried: 0, failed: 0 });
  }
  for (const entry of finished) {
    const bucket = buckets.get(floor(new Date(attemptTime(entry))).getTime());
    if (bucket) bucket[entry.outcome]++;
  }
  return { unit, buckets: [...buckets.values()] };
}

// From each option's latest validated observation; an option not scraped successfully yet is "unknown".
export function stockCounts(items: Pick<TrackedProduct, 'latest'>[]) {
  const counts = { inStock: 0, outOfStock: 0, unknown: 0 };
  for (const item of items) {
    const status = stockStatus(item.latest?.stock);
    if (status === 'inStock' || status === 'outOfStock') counts[status]++;
    else counts.unknown++;
  }
  return counts;
}

// The latest observation against the previous one, as the dashboard and tracked table show it.
export function latestChange({ latest, previous }: Pick<TrackedProduct, 'latest' | 'previous'>) {
  if (!latest) return null;
  return {
    current: latest.price,
    currency: latest.currency,
    previous: previous?.price ?? null,
    amount: previous ? latest.price - previous.price : null,
    pct: priceChangePct({ latest, previous }),
  };
}

export type ComparisonRow = { id: number; item: TrackedProduct; changePct: number | null; successful: number; failed: number };

// One row per tracked option, its attempt counts taken from `entries` (already limited to the chosen range).
export function comparisonRows(items: TrackedProduct[], entries: LogEntry[]): ComparisonRow[] {
  return items.map(item => {
    const { successful, failed } = reliability(entries.filter(entry => entry.trackedId === item.id));
    return { id: item.id, item, changePct: priceChangePct(item), successful, failed };
  });
}
