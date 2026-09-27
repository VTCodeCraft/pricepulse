import { describe, expect, it } from 'vitest';
import { priceChangePct, stockStatus } from './observations';

describe('stockStatus', () => {
  it('maps the store count to a state without inventing "low stock"', () => {
    expect(stockStatus(158)).toBe('inStock');
    expect(stockStatus(1)).toBe('inStock');
    expect(stockStatus(0)).toBe('outOfStock');
    expect(stockStatus(null)).toBe('unknown');
    expect(stockStatus(undefined)).toBe('unknown');
  });
});

describe('priceChangePct', () => {
  const observation = (price: number) => ({ price, stock: 1, observedAt: '2026-09-27T09:00:00Z' });

  it('compares the latest price with the previous one', () => {
    const latest = { ...observation(33504), currency: 'INR', mrp: null, memberPrice: null };
    expect(priceChangePct({ latest, previous: observation(41099) })).toBeCloseTo(-18.48, 2);
  });

  it('is null until there are two observations', () => {
    expect(priceChangePct({ latest: null, previous: null })).toBeNull();
    const latest = { ...observation(100), currency: 'INR', mrp: null, memberPrice: null };
    expect(priceChangePct({ latest, previous: null })).toBeNull();
  });
});
