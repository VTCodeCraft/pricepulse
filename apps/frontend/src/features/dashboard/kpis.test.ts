import { describe, expect, it } from 'vitest';
import type { TrackedProduct } from '../../types/product';
import type { ScrapeAttempt } from '../../types/scrape';
import { attemptCountsSince, averagePriceChange } from './kpis';

const attempt = (finishedAt: string | null, outcome: ScrapeAttempt['outcome']): ScrapeAttempt => ({
  id: 1, runId: 1, trigger: 'cron', startedAt: finishedAt ?? '2026-09-27T09:00:00Z', finishedAt, outcome,
  price: outcome === 'failed' || outcome === null ? null : 100, currency: 'INR', stock: 1, tries: 1,
  errorCode: null, errorMessage: null, layoutRevision: null, tryLog: [],
});

describe('attemptCountsSince', () => {
  const since = new Date('2026-09-27T00:00:00Z');

  it('counts the finished attempts inside the window; retried ones are successful too', () => {
    const logs = [
      [attempt('2026-09-27T09:04:26Z', 'retried'), attempt('2026-09-27T06:47:39Z', 'success'), attempt('2026-09-26T20:52:11Z', 'success')],
      [attempt('2026-09-27T08:08:05Z', 'failed'), attempt(null, null)],
    ];
    expect(attemptCountsSince(logs, since, 100)).toEqual({ successful: 2, retried: 1, failed: 1, partial: false });
  });

  // A run cut off by a crash never writes its counters, but its attempts are still in the log.
  it('includes attempts of a run that was abandoned', () => {
    const logs = [[{ ...attempt('2026-09-27T08:07:10Z', 'retried'), runId: 19 }, { ...attempt('2026-09-27T09:01:17Z', 'failed'), runId: 19 }]];
    expect(attemptCountsSince(logs, since, 100)).toMatchObject({ successful: 1, failed: 1 });
  });

  it('is partial when a log came back full and all of it is inside the window', () => {
    const full = [attempt('2026-09-27T09:00:00Z', 'success'), attempt('2026-09-27T08:00:00Z', 'success')];
    expect(attemptCountsSince([full], since, 2).partial).toBe(true);
    expect(attemptCountsSince([[...full, attempt('2026-09-26T08:00:00Z', 'success')]], since, 3).partial).toBe(false);
  });
});

describe('averagePriceChange', () => {
  const item = (latest: number, previous: number | null) =>
    ({
      latest: { price: latest, currency: 'INR', stock: 1, observedAt: '', mrp: null, memberPrice: null },
      previous: previous === null ? null : { price: previous, stock: 1, observedAt: '' },
    }) as TrackedProduct;

  it('averages the options that have two observations and ignores the rest', () => {
    expect(averagePriceChange([item(110, 100), item(90, 100), item(50, null)])).toEqual({ pct: 0, options: 2 });
  });

  it('is null when no option has two observations yet', () => {
    expect(averagePriceChange([item(50, null)])).toBeNull();
    expect(averagePriceChange([])).toBeNull();
  });
});
