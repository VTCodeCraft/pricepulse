import { describe, expect, it } from 'vitest';
import { rangeStart } from '../../lib/utils/timeRange';
import type { TrackedProduct } from '../../types/product';
import type { ScrapeOutcome } from '../../types/scrape';
import { NO_FILTERS, filterLog, type LogEntry } from '../scraping/scrapeLog';
import { attemptsOverTime, comparisonRows, latestChange, reliability, stockCounts } from './analytics';

let nextId = 1;
const entry = (trackedId: number, finishedAt: string | null, outcome: ScrapeOutcome | null): LogEntry => ({
  id: nextId++,
  runId: 1,
  trigger: 'cron',
  startedAt: finishedAt ?? '2026-09-27T11:00:05.000Z',
  finishedAt,
  outcome,
  price: outcome === 'failed' || outcome === null ? null : 1000,
  currency: outcome === 'failed' || outcome === null ? null : 'INR',
  stock: outcome === 'failed' || outcome === null ? null : 5,
  tries: 1,
  errorCode: outcome === 'failed' ? 'interrupted' : null,
  errorMessage: null,
  layoutRevision: null,
  tryLog: [],
  trackedId,
  storeProductId: 2000 + trackedId,
  productName: `Product ${trackedId}`,
  optionId: 'o1',
  optionLabel: 'Standard',
  isTracked: true,
});

const now = new Date('2026-09-27T11:30:00.000Z');
const log = [
  entry(3, '2026-09-26T18:40:57.366Z', 'retried'),
  entry(3, '2026-09-27T09:05:25.718Z', 'retried'),
  entry(3, '2026-09-27T10:04:30.132Z', 'success'),
  entry(9, '2026-09-27T08:07:10.942Z', 'success'),
  entry(9, '2026-09-27T09:01:18.101Z', 'failed'),
  entry(9, null, null), // still running
];

describe('reliability', () => {
  it('counts retried inside successful, as the backend classified it, and leaves running attempts out', () => {
    expect(reliability(log)).toEqual({ successful: 4, retried: 2, failed: 1, running: 1, finished: 5, successRate: 80 });
  });

  it('matches the production totals at the time of the F4 export (32 success, 19 retried, 1 failed)', () => {
    const outcomes = [...Array(32).fill('success'), ...Array(19).fill('retried'), 'failed'].map(outcome => ({ outcome }));
    const result = reliability(outcomes);
    expect([result.successful, result.retried, result.failed]).toEqual([51, 19, 1]);
    expect(result.successRate).toBeCloseTo((51 / 52) * 100);
  });

  it('has no success rate without finished attempts', () => {
    expect(reliability([]).successRate).toBeNull();
    expect(reliability([{ outcome: null }]).successRate).toBeNull();
  });
});

describe('attemptsOverTime', () => {
  it('buckets finished attempts by local hour from the first one up to now, never past it', () => {
    const { unit, buckets } = attemptsOverTime(log, now);
    expect(unit).toBe('hour');
    const first = new Date('2026-09-26T18:40:57.366Z');
    first.setMinutes(0, 0, 0);
    expect(buckets[0].start).toBe(first.getTime());
    expect(buckets.at(-1)?.start).toBeLessThanOrEqual(now.getTime());
    const totals = buckets.reduce((sum, b) => ({ s: sum.s + b.success, r: sum.r + b.retried, f: sum.f + b.failed }), { s: 0, r: 0, f: 0 });
    expect(totals).toEqual({ s: 2, r: 2, f: 1 }); // the running attempt is not counted
    expect(buckets.some(b => b.success + b.retried + b.failed === 0)).toBe(true); // quiet hours stay visible as zeros
  });

  it('switches to days when the data spans more than two days', () => {
    const { unit, buckets } = attemptsOverTime([entry(1, '2026-09-20T10:00:00.000Z', 'success'), ...log], now);
    expect(unit).toBe('day');
    expect(buckets.every(b => new Date(b.start).getHours() === 0)).toBe(true);
  });

  it('follows the selected range', () => {
    const evening = new Date('2026-09-27T19:00:00.000Z'); // 24H starts 26 Sep 19:00 UTC, after the 18:40 attempt
    const lastDay = filterLog(log, { ...NO_FILTERS, range: '24h' }, evening);
    expect(rangeStart('24h', evening)?.toISOString()).toBe('2026-09-26T19:00:00.000Z');
    expect(attemptsOverTime(lastDay, evening).buckets.reduce((n, b) => n + b.success + b.retried + b.failed, 0)).toBe(4);
  });

  it('returns nothing for an empty log', () => {
    expect(attemptsOverTime([], now).buckets).toEqual([]);
  });
});

describe('stockCounts', () => {
  it('counts the latest scraped stock of each option; no low-stock state is invented', () => {
    // The ten production options' latest stock on 27 Sep 2026.
    const items = [73, 0, 17, 0, 17, 19, 0, 142, 0, 29].map(stock => ({ latest: { price: 1, currency: 'INR', stock, observedAt: '', mrp: null, memberPrice: null } }));
    expect(stockCounts([...items, { latest: null }])).toEqual({ inStock: 6, outOfStock: 4, unknown: 1 });
  });
});

describe('latestChange', () => {
  it('compares the latest observation with the previous one (Halvard Drawing Tablet · 256 GB)', () => {
    const change = latestChange({
      latest: { price: 83407, currency: 'INR', stock: 17, observedAt: '2026-09-27T10:04:30.132Z', mrp: null, memberPrice: null },
      previous: { price: 125510, stock: 67, observedAt: '2026-09-27T09:05:25.718Z' },
    });
    expect(change).toMatchObject({ current: 83407, previous: 125510, amount: -42103 });
    expect(change?.pct).toBeCloseTo(-33.546, 2);
  });

  it('has no change with a single observation, and nothing before the first', () => {
    const latest = { price: 78751, currency: 'INR', stock: 0, observedAt: '2026-09-26T17:20:00.000Z', mrp: null, memberPrice: null };
    expect(latestChange({ latest, previous: null })).toMatchObject({ previous: null, amount: null, pct: null });
    expect(latestChange({ latest: null, previous: null })).toBeNull();
  });
});

describe('comparisonRows', () => {
  it('gives each option its own attempt counts', () => {
    const items = [3, 9].map(id => ({ id, latest: null, previous: null }) as TrackedProduct);
    expect(comparisonRows(items, log).map(({ id, successful, failed }) => [id, successful, failed])).toEqual([
      [3, 3, 0],
      [9, 1, 1],
    ]);
  });
});
