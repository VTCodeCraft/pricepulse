import { describe, expect, it } from 'vitest';
import { observationAlerts } from '../src/services/alerts.service.js';

const tracked = { id: 7, store_product_id: 2331, product_name: 'Halvard Tab', option_id: 'o3', option_label: '256 GB', price_drop_threshold_pct: '5.00' };
const seen = (price, stock, overrides = {}) => ({ outcome: 'success', price, currency: 'INR', stock, finishedAt: '2026-09-27T10:00:00Z', ...overrides });
const types = (previous, current) => observationAlerts(previous, current, tracked).map(alert => alert.type);

describe('price drop', () => {
  it('a lower price alerts, with the product, option, both prices and the change', () => {
    const [alert] = observationAlerts(seen('1000.00', 4), seen(900, 4), tracked);
    expect(alert).toMatchObject({
      type: 'price_drop',
      severity: 'warning',
      data: { storeProductId: 2331, productName: 'Halvard Tab', optionId: 'o3', optionLabel: '256 GB', currency: 'INR', previousPrice: 1000, currentPrice: 900, change: -100, changePct: -10, previousObservedAt: '2026-09-27T10:00:00Z' },
    });
    expect(alert.message).toBe('Halvard Tab · 256 GB: INR 1,000 → INR 900 (-10%)');
  });

  it('a drop smaller than the threshold is still recorded, as info', () => {
    expect(observationAlerts(seen(1000, 4), seen(990, 4), tracked)[0]).toMatchObject({ type: 'price_drop', severity: 'info', data: { changePct: -1 } });
  });

  it('the same or a higher price does not alert', () => {
    expect(types(seen(1000, 4), seen(1000, 4))).toEqual([]);
    expect(types(seen(1000, 4), seen(1000.01, 4))).toEqual([]);
  });

  it('a failed or invalid observation never alerts, on either side', () => {
    const failed = { outcome: 'failed', price: null, currency: null, stock: null };
    expect(types(seen(1000, 0), failed)).toEqual([]);
    expect(types(failed, seen(900, 5))).toEqual([]);
    expect(types(undefined, seen(900, 5))).toEqual([]);
    expect(types(seen(1000, 0), seen(null, 5))).toEqual([]);
    expect(types(seen(1000, 0), seen(0, 5))).toEqual([]);
    expect(types(seen(1000, 0), seen('', 5))).toEqual([]);
    expect(types(seen(1000, 0), seen(900, null))).toEqual([]);
    expect(types(seen(1000, 0), seen(900, 5, { outcome: null }))).toEqual([]);
  });

  it('prices in different currencies are not compared', () => {
    expect(types(seen(1000, 4), seen(12, 4, { currency: 'EUR' }))).toEqual([]);
  });
});

describe('back in stock', () => {
  it('out of stock → in stock alerts with both states', () => {
    const [alert] = observationAlerts(seen(1000, 0), seen(1000, 3), tracked);
    expect(alert).toMatchObject({ type: 'back_in_stock', data: { previousState: 'out_of_stock', currentState: 'in_stock', previousStock: 0, currentStock: 3 } });
  });

  it('staying in stock, staying out of stock or selling out does not alert', () => {
    expect(types(seen(1000, 3), seen(1000, 9))).toEqual([]);
    expect(types(seen(1000, 0), seen(1000, 0))).toEqual([]);
    expect(types(seen(1000, 3), seen(1000, 0))).toEqual([]);
  });

  it('a failed attempt in between does not count as a state', () => {
    expect(types(seen(1000, 0), { outcome: 'failed', price: null, currency: null, stock: null })).toEqual([]);
  });

  it('a drop and a return to stock in one observation raise both alerts', () => {
    expect(types(seen(1000, 0), seen(800, 2))).toEqual(['price_drop', 'back_in_stock']);
  });
});
