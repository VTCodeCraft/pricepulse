import { describe, expect, it } from 'vitest';
import { rangeStart } from '../../lib/utils/timeRange';
import type { PricePoint } from '../../types/scrape';
import { HISTORY_LIMIT, isHistoryCut, pointsSince, priceSummary, timeTicks } from './priceHistory';

// Observations of one production option (Halvard Drawing Tablet Prime · 256 GB), as GET /api/tracked/3/history returned them.
const point = (observedAt: string, price: number, outcome: PricePoint['outcome'] = 'success'): PricePoint => ({
  observedAt,
  price,
  currency: 'INR',
  stock: 10,
  outcome,
});
const history = [
  point('2026-09-26T18:40:57.366Z', 113279, 'retried'),
  point('2026-09-26T19:18:37.628Z', 117570),
  point('2026-09-26T20:41:32.010Z', 116878),
  point('2026-09-26T20:52:28.009Z', 128426),
  point('2026-09-27T06:48:02.964Z', 130142),
  point('2026-09-27T09:05:25.718Z', 125510, 'retried'),
  point('2026-09-27T10:04:30.132Z', 83407),
];

describe('priceSummary', () => {
  it('computes lowest, highest, average and first-to-last change', () => {
    const summary = priceSummary(history);
    expect(summary?.count).toBe(7);
    expect(summary?.lowest.price).toBe(83407);
    expect(summary?.highest).toEqual(history[4]);
    expect(summary?.average).toBeCloseTo(815212 / 7);
    expect(summary?.changePct).toBeCloseTo(((83407 - 113279) / 113279) * 100); // −26.4 %
  });

  it('gives no change until there are two observations', () => {
    expect(priceSummary([history[0]])?.changePct).toBeNull();
    expect(priceSummary([])).toBeNull();
  });

  it('reports the first time the lowest price was seen', () => {
    const summary = priceSummary([point('2026-09-26T10:00:00Z', 500), point('2026-09-26T12:00:00Z', 500)]);
    expect(summary?.lowest.observedAt).toBe('2026-09-26T10:00:00Z');
    expect(summary?.changePct).toBe(0);
  });
});

describe('pointsSince', () => {
  it('keeps the observations inside the range, compared as UTC instants', () => {
    const now = new Date('2026-09-27T19:00:00Z');
    const lastDay = pointsSince(history, rangeStart('24h', now));
    expect(lastDay.map(p => p.price)).toEqual([117570, 116878, 128426, 130142, 125510, 83407]); // 18:40 UTC is out
    expect(priceSummary(lastDay)?.changePct).toBeCloseTo(((83407 - 117570) / 117570) * 100);
    expect(pointsSince(history, rangeStart('all', now))).toHaveLength(7);
  });

  it('includes an observation exactly at the start of the range', () => {
    expect(pointsSince(history, new Date('2026-09-27T10:04:30.132Z'))).toEqual([history[6]]);
  });
});

describe('isHistoryCut', () => {
  const full = Array.from({ length: HISTORY_LIMIT }, (_, i) => point(new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(), 100));

  it('flags a range that reaches past the oldest observation of a full response', () => {
    expect(isHistoryCut(full, null)).toBe(true);
    expect(isHistoryCut(full, new Date('2025-12-31T00:00:00Z'))).toBe(true);
    expect(isHistoryCut(full, new Date('2026-02-01T00:00:00Z'))).toBe(false);
  });

  it('never flags a response shorter than the limit', () => {
    expect(isHistoryCut(history, null)).toBe(false);
  });
});

describe('timeTicks', () => {
  // Checked in whatever zone the tests run in: ticks fall on round local clock times, evenly spaced, inside the data.
  it('spaces ticks on round local hours across the data', () => {
    const from = Date.parse(history[0].observedAt);
    const to = Date.parse(history[6].observedAt);
    const { ticks } = timeTicks(from, to);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    for (const tick of ticks) {
      expect(tick).toBeGreaterThanOrEqual(from);
      expect(tick).toBeLessThanOrEqual(to);
      expect(new Date(tick).getMinutes()).toBe(0);
      expect(new Date(tick).getHours() % 3).toBe(0); // 15.4 hours of data: every 3 hours
    }
  });

  it('switches to whole days for longer ranges', () => {
    const from = Date.parse('2026-06-29T10:00:00Z');
    const { ticks, label } = timeTicks(from, from + 90 * 24 * 3_600_000);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(new Date(ticks[0]).getHours()).toBe(0);
    expect(label(ticks[0])).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
  });
});
