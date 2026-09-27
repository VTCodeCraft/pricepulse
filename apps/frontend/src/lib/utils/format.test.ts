import { describe, expect, it } from 'vitest';
import { formatPrice, formatSignedPercent } from './format';

describe('formatPrice', () => {
  it('uses Indian digit grouping and no decimals', () => {
    expect(formatPrice(117570)).toBe('₹1,17,570');
    expect(formatPrice(1389)).toBe('₹1,389');
    expect(formatPrice(33504.4)).toBe('₹33,504');
  });
});

describe('formatSignedPercent', () => {
  it('always shows the direction', () => {
    expect(formatSignedPercent(2.44)).toBe('+2.4%');
    expect(formatSignedPercent(-18.48)).toBe('−18.5%');
    expect(formatSignedPercent(0)).toBe('0.0%');
  });
});
