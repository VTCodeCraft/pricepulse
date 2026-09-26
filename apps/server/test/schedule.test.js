import { describe, expect, it } from 'vitest';
import { SCRAPE_INTERVALS, isDue, nextAligned, nextSlotAfterRun } from '../src/schedule.js';

const iso = date => date.toISOString();
const utc = text => new Date(`${text}Z`);

describe('nextAligned', () => {
  it.each([
    ['2026-09-26T16:00:00', 120, '2026-09-26T18:00:00'], // exactly on a slot → the next slot
    ['2026-09-26T16:07:12', 120, '2026-09-26T18:00:00'],
    ['2026-09-26T17:59:59', 120, '2026-09-26T18:00:00'],
    ['2026-09-26T23:30:00', 120, '2026-09-27T00:00:00'],
    ['2026-09-26T16:07:00', 60, '2026-09-26T17:00:00'],
    ['2026-09-26T16:07:00', 240, '2026-09-26T20:00:00'],
    ['2026-09-26T16:07:00', 360, '2026-09-26T18:00:00'],
    ['2026-09-26T16:07:00', 720, '2026-09-27T00:00:00'],
    ['2026-09-26T16:07:00', 1440, '2026-09-27T00:00:00'],
  ])('%s every %i min → %s UTC', (from, interval, expected) => {
    expect(iso(nextAligned(utc(from), interval))).toBe(iso(utc(expected)));
  });

  it('keeps 120-minute slots on even UTC hours without drifting over a week', () => {
    let slot = nextAligned(utc('2026-09-26T16:23:45'), 120);
    for (let i = 0; i < 84; i++) {
      expect(slot.getUTCHours() % 2).toBe(0);
      expect(slot.getUTCMinutes() + slot.getUTCSeconds() + slot.getUTCMilliseconds()).toBe(0);
      slot = nextAligned(slot, 120);
    }
    expect(iso(slot)).toBe(iso(utc('2026-10-03T18:00:00')));
  });

  it('only the approved intervals exist', () => {
    expect(SCRAPE_INTERVALS).toEqual([60, 120, 240, 360, 720, 1440]);
  });
});

describe('isDue', () => {
  const slot = utc('2026-09-26T16:00:00');
  it.each([
    ['on time', '2026-09-26T16:00:00', true],
    ['a cron call 3 minutes early', '2026-09-26T15:57:00', true],
    ['10 minutes early', '2026-09-26T15:50:00', false],
    ['hours overdue', '2026-09-26T21:00:00', true],
  ])('%s', (_label, now, due) => {
    expect(isDue(slot, utc(now), 5)).toBe(due);
  });
});

describe('nextSlotAfterRun', () => {
  const slot = utc('2026-09-26T16:00:00');
  it.each([
    ['ran on time', slot, '2026-09-26T16:00:40', '2026-09-26T18:00:00'],
    ['cron fired 2 minutes early', slot, '2026-09-26T15:58:00', '2026-09-26T18:00:00'],
    ['run finished after the next slot started', slot, '2026-09-26T18:03:00', '2026-09-26T20:00:00'],
    ['several ticks were missed: runs once, then back on schedule', utc('2026-09-26T08:00:00'), '2026-09-26T16:05:00', '2026-09-26T18:00:00'],
  ])('%s', (_label, served, ranAt, expected) => {
    expect(iso(nextSlotAfterRun(served, utc(ranAt), 120))).toBe(iso(utc(expected)));
  });

  it('an interval change re-aligns from now', () => {
    expect(iso(nextAligned(utc('2026-09-26T16:30:00'), 60))).toBe(iso(utc('2026-09-26T17:00:00')));
    expect(iso(nextAligned(utc('2026-09-26T16:30:00'), 1440))).toBe(iso(utc('2026-09-27T00:00:00')));
  });
});
