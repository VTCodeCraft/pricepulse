import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, attemptsToCsv } from '../src/csv.js';

const row = overrides => ({
  store_product_id: 2331,
  product_name: 'Halvard Drawing Tablet Prime',
  selected_option: '64 GB',
  finished_at: new Date('2026-09-26T16:00:41.512Z'),
  price: '90313.00',
  stock: 141,
  outcome: 'success',
  ...overrides,
});

describe('attemptsToCsv', () => {
  it('uses exactly the required columns, in order', () => {
    expect(CSV_COLUMNS).toEqual(['store_product_id', 'product_name', 'selected_option', 'timestamp', 'price', 'stock', 'outcome']);
    expect(attemptsToCsv([]).split('\r\n')[0]).toBe(CSV_COLUMNS.join(','));
  });

  it('writes one row per attempt with an ISO 8601 UTC timestamp', () => {
    const [, first, second] = attemptsToCsv([row(), row({ outcome: 'retried', stock: 0 })]).split('\r\n');
    expect(first).toBe('2331,Halvard Drawing Tablet Prime,64 GB,2026-09-26T16:00:41.512Z,90313.00,141,success');
    expect(second).toBe('2331,Halvard Drawing Tablet Prime,64 GB,2026-09-26T16:00:41.512Z,90313.00,0,retried');
  });

  it('leaves price and stock empty for a failed attempt', () => {
    const [, line] = attemptsToCsv([row({ price: null, stock: null, outcome: 'failed' })]).split('\r\n');
    expect(line).toBe('2331,Halvard Drawing Tablet Prime,64 GB,2026-09-26T16:00:41.512Z,,,failed');
  });

  it('quotes commas and quotes, and neutralises spreadsheet formulas', () => {
    const [, line] = attemptsToCsv([row({ product_name: 'Widget, "Deluxe"', selected_option: '=SUM(A1)' })]).split('\r\n');
    expect(line).toBe(`2331,"Widget, ""Deluxe""",'=SUM(A1),2026-09-26T16:00:41.512Z,90313.00,141,success`);
  });
});
