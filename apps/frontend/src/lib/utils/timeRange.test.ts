import { describe, expect, it } from 'vitest';
import { rangeStart } from './timeRange';

describe('rangeStart', () => {
  const now = new Date('2026-09-27T10:38:00.000Z');

  it('counts exact hours back from now', () => {
    expect(rangeStart('24h', now)?.toISOString()).toBe('2026-09-26T10:38:00.000Z');
    expect(rangeStart('90d', now)?.toISOString()).toBe('2026-06-29T10:38:00.000Z');
    expect(rangeStart('all', now)).toBeNull();
  });

  it('is not shifted by a daylight-saving change in the browser zone', () => {
    // Europe moved its clocks on 29 March 2026; 7D is still exactly 168 hours.
    const start = rangeStart('7d', new Date('2026-04-01T12:00:00.000Z'));
    expect(start?.toISOString()).toBe('2026-03-25T12:00:00.000Z');
  });
});
