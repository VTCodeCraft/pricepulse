import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/client';
import type { CatalogSearch } from '../../types/product';
import { searchQuery, searchView } from './search';

describe('searchQuery', () => {
  it('trims and collapses spaces so equal searches share one request', () => {
    expect(searchQuery('  halvard   tablet ')).toBe('halvard tablet');
  });

  it('is null outside the 2 to 100 characters the API accepts', () => {
    expect(searchQuery('')).toBeNull();
    expect(searchQuery(' a ')).toBeNull();
    expect(searchQuery('ab')).toBe('ab');
    expect(searchQuery('x'.repeat(101))).toBeNull();
  });
});

describe('searchView', () => {
  const data = (count: number): CatalogSearch => ({
    query: 'halvard',
    catalog: { count: 960, syncedAt: null, syncing: false },
    results: Array.from({ length: count }, (_, i) => ({ storeProductId: 2000 + i, name: 'Halvard', brand: null, category: null, sku: null })),
  });
  const done = (result: CatalogSearch) => ({ isPending: false, isError: false, error: null, data: result });

  it('asks for more characters before searching', () => {
    expect(searchView(null, null, { isPending: true, isError: false, error: null })).toBe('hint');
  });

  it('hides the previous results while the debounce is pending', () => {
    expect(searchView('halvard t', 'halvard', done(data(3)))).toBe('loading');
  });

  it('shows results, or an empty state when nothing matches', () => {
    expect(searchView('halvard', 'halvard', done(data(3)))).toBe('results');
    expect(searchView('halvard', 'halvard', done(data(0)))).toBe('empty');
  });

  it('tells a first-time catalogue load apart from other errors', () => {
    const syncing = new ApiError(503, 'catalog_syncing', 'The product catalogue is loading');
    expect(searchView('ab', 'ab', { isPending: false, isError: true, error: syncing })).toBe('syncing');
    expect(searchView('ab', 'ab', { isPending: false, isError: true, error: new ApiError(0, 'network', 'down') })).toBe('error');
  });
});
