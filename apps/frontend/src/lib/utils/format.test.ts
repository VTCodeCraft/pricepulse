import { describe, expect, it } from 'vitest';
import { formatDuration, formatPrice, formatSignedPercent, formatSignedPrice, formatTimestamp } from './format';

describe('formatPrice', () => {
  it('uses Indian digit grouping and no decimals', () => {
    expect(formatPrice(117570)).toBe('₹1,17,570');
    expect(formatPrice(1389)).toBe('₹1,389');
    expect(formatPrice(33504.4)).toBe('₹33,504');
  });
});

describe('formatSignedPrice', () => {
  it('signs the amount like a percentage change', () => {
    expect(formatSignedPrice(-42103)).toBe('−₹42,103');
    expect(formatSignedPrice(4291)).toBe('+₹4,291');
    expect(formatSignedPrice(0)).toBe('₹0');
  });
});

describe('formatSignedPercent', () => {
  it('always shows the direction', () => {
    expect(formatSignedPercent(2.44)).toBe('+2.4%');
    expect(formatSignedPercent(-18.48)).toBe('−18.5%');
    expect(formatSignedPercent(0)).toBe('0.0%');
  });
});

describe('formatDuration', () => {
  it('picks a unit that stays readable from milliseconds to hours', () => {
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(17_175)).toBe('17.2 s');
    expect(formatDuration(3_201_064)).toBe('53 min 21 s'); // the interrupted attempt closed by the stale-run reaper
    expect(formatDuration(3_900_000)).toBe('1 h 5 min');
  });
});

describe('formatTimestamp', () => {
  it('shows the exact local time with its UTC offset', () => {
    const iso = '2026-09-27T10:04:30.132Z';
    const offset = -new Date(iso).getTimezoneOffset(); // minutes east of UTC in the test machine's zone
    const local = new Date(Date.parse(iso) + offset * 60_000);
    const hhmmss = local.toISOString().slice(11, 19);
    expect(formatTimestamp(iso)).toContain(hhmmss);
    expect(formatTimestamp(iso)).toMatch(/GMT([+-]\d{1,2}(:\d{2})?)?$/);
  });
});
