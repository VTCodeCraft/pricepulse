import { describe, expect, it } from 'vitest';
import type { ScrapeAttempt } from '../../types/scrape';
import {
  NO_FILTERS,
  attemptDurationMs,
  attemptPrice,
  attemptStatus,
  attemptStock,
  filterLog,
  mergeLogs,
  outcomeCounts,
  toLogEntries,
} from './scrapeLog';

// Attempts as the production API returned them (run 19 was cut off and closed as abandoned).
const attempt = (fields: Partial<ScrapeAttempt> & Pick<ScrapeAttempt, 'id' | 'runId' | 'startedAt' | 'finishedAt' | 'outcome'>): ScrapeAttempt => ({
  trigger: 'cron',
  price: null,
  currency: null,
  stock: null,
  tries: 1,
  errorCode: null,
  errorMessage: null,
  layoutRevision: 634002,
  tryLog: [],
  ...fields,
});

const interrupted = attempt({
  id: 34,
  runId: 19,
  startedAt: '2026-09-27T08:07:57.037Z',
  finishedAt: '2026-09-27T09:01:18.101Z',
  outcome: 'failed',
  tries: 0,
  errorCode: 'interrupted',
  errorMessage: 'the run stopped before this attempt finished',
});
// The store's own retry made this "retried" although our scraper needed a single try.
const retriedInOneTry = attempt({
  id: 41,
  runId: 20,
  startedAt: '2026-09-27T09:04:31.449Z',
  finishedAt: '2026-09-27T09:05:25.718Z',
  outcome: 'retried',
  price: 125510,
  currency: 'INR',
  stock: 67,
});
const success = attempt({
  id: 51,
  runId: 21,
  startedAt: '2026-09-27T10:04:12.814Z',
  finishedAt: '2026-09-27T10:04:30.132Z',
  outcome: 'success',
  price: 83407,
  currency: 'INR',
  stock: 17,
});
const running = attempt({ id: 60, runId: 22, startedAt: '2026-09-27T11:00:05.000Z', finishedAt: null, outcome: null, tries: 0 });

const tent = { id: 9, storeProductId: 2033, productName: 'Tamarack Tent One', optionId: 'o2', optionLabel: 'Duo', isActive: true };
const tablet = { id: 3, storeProductId: 2331, productName: 'Halvard Drawing Tablet Prime', optionId: 'o3', optionLabel: '256 GB', isActive: true };
const log = mergeLogs([toLogEntries(tent, [interrupted]), toLogEntries(tablet, [running, success, retriedInOneTry])]);

describe('mergeLogs', () => {
  it('orders every option’s attempts newest first, a running one by its start', () => {
    expect(log.map(entry => entry.id)).toEqual([60, 51, 41, 34]);
    expect(log[3]).toMatchObject({ productName: 'Tamarack Tent One', optionLabel: 'Duo', trackedId: 9 });
  });
});

describe('attempt classification and display', () => {
  it('takes the outcome from the backend instead of the number of tries', () => {
    expect(attemptStatus(retriedInOneTry.outcome)).toBe('retried');
    expect(attemptStatus(interrupted.outcome)).toBe('failed');
    expect(attemptStatus(running.outcome)).toBe('running');
  });

  it('shows no price or stock for a failed or running attempt', () => {
    expect([attemptPrice(interrupted), attemptStock(interrupted)]).toEqual(['—', '—']);
    expect([attemptPrice(running), attemptStock(running)]).toEqual(['—', '—']);
    expect([attemptPrice(success), attemptStock(success)]).toEqual(['₹83,407', '17 in stock']);
    expect(attemptStock({ stock: 0 })).toBe('Out of stock');
  });

  it('measures duration from start to finish, and none while running', () => {
    expect(attemptDurationMs(success)).toBe(17_318);
    expect(attemptDurationMs(interrupted)).toBe(3_201_064); // until the stale-run reaper closed it
    expect(attemptDurationMs(running)).toBeNull();
  });
});

describe('filterLog', () => {
  const now = new Date('2026-09-27T11:00:30Z');

  it('filters by option, outcome and time range together', () => {
    expect(filterLog(log, { ...NO_FILTERS, trackedId: 3 }, now).map(e => e.id)).toEqual([60, 51, 41]);
    expect(filterLog(log, { ...NO_FILTERS, outcome: 'retried' }, now).map(e => e.id)).toEqual([41]);
    expect(filterLog(log, { ...NO_FILTERS, range: '24h', outcome: 'failed' }, now).map(e => e.id)).toEqual([34]);
    expect(filterLog(log, { ...NO_FILTERS, trackedId: 9, outcome: 'success' }, now)).toEqual([]);
  });

  it('searches product, option, error and attempt number, every word required', () => {
    expect(filterLog(log, { ...NO_FILTERS, search: 'interrupted' }, now).map(e => e.id)).toEqual([34]);
    expect(filterLog(log, { ...NO_FILTERS, search: 'halvard 256' }, now)).toHaveLength(3);
    expect(filterLog(log, { ...NO_FILTERS, search: '#51' }, now).map(e => e.id)).toEqual([51]);
    expect(filterLog(log, { ...NO_FILTERS, search: 'tent 256' }, now)).toEqual([]);
  });
});

describe('outcomeCounts', () => {
  it('counts a run from its attempts, even when the abandoned run recorded 0/0/0', () => {
    const run19 = [{ outcome: 'retried' as const }, { outcome: 'retried' as const }, interrupted];
    expect(outcomeCounts(run19)).toEqual({ success: 0, retried: 2, failed: 1, running: 0 });
    expect(outcomeCounts([running])).toEqual({ success: 0, retried: 0, failed: 0, running: 1 });
  });
});
