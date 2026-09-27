import type { TrackedProduct } from '../../types/product';
import type { ScrapeAttempt } from '../../types/scrape';
import { priceChangePct } from '../../lib/utils/observations';

export type ScrapeCounts = { successful: number; retried: number; failed: number; partial: boolean };

// Outcomes of the attempts that finished since `since`, over several options' logs (each the newest `limit` attempts).
// When a log came back full and even its oldest attempt is inside the window, older ones were not fetched: `partial`.
export function attemptCountsSince(logs: ScrapeAttempt[][], since: Date, limit: number): ScrapeCounts {
  const counts = { successful: 0, retried: 0, failed: 0, partial: false };
  for (const log of logs) {
    const inWindow = log.filter(attempt => attempt.finishedAt !== null && new Date(attempt.finishedAt) >= since);
    if (log.length === limit && inWindow.length === log.length) counts.partial = true;
    for (const { outcome } of inWindow) {
      if (outcome === 'failed') counts.failed++;
      else counts.successful++; // success or retried: both produced a validated observation
      if (outcome === 'retried') counts.retried++;
    }
  }
  return counts;
}

// Mean of each option's change since its previous observation, over the options that have two observations.
export function averagePriceChange(items: TrackedProduct[]): { pct: number; options: number } | null {
  const changes = items.map(priceChangePct).filter((pct): pct is number => pct !== null);
  if (!changes.length) return null;
  return { pct: changes.reduce((sum, pct) => sum + pct, 0) / changes.length, options: changes.length };
}
