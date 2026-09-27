// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateTracked } from '../../../lib/api/tracked';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { TrackedProduct } from '../../../types/product';
import { OptionTrackingPanel } from './OptionTrackingPanel';

vi.mock('../../../lib/api/tracked', () => ({ listTracked: vi.fn(), track: vi.fn(), untrack: vi.fn(), scrapeTracked: vi.fn(), updateTracked: vi.fn() }));

// Test fixture shaped like a GET /api/tracked item; not production data.
const item: TrackedProduct = {
  id: 3,
  storeProductId: 2331,
  productUrl: 'https://demo.inelabteamdev.com/item/2331',
  productName: 'Halvard Drawing Tablet Prime',
  brand: 'Halvard',
  category: 'Tablets',
  sku: 'SK-2331-HA',
  description: null,
  optionAxis: 'Storage',
  optionId: 'o1',
  optionLabel: '64 GB',
  options: [{ id: 'o1', label: '64 GB' }],
  specs: null,
  reviewSummary: null,
  isActive: true,
  scrapeIntervalMinutes: 120,
  nextScrapeAt: '2026-09-27T14:00:00.000Z',
  priceDropThresholdPct: 5,
  lastManualScrapeAt: null,
  createdAt: '2026-09-26T17:19:40.148Z',
  latest: { price: 91236, currency: 'INR', stock: 12, observedAt: '2026-09-27T10:04:30.132Z', mrp: null, memberPrice: null },
  previous: null,
  lastAttempt: { outcome: 'success', finishedAt: '2026-09-27T10:04:30.132Z', errorCode: null },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('scrape interval', () => {
  it('shows the option’s interval and sends a new one to the server', async () => {
    vi.mocked(updateTracked).mockResolvedValue({ ...item, scrapeIntervalMinutes: 360 });
    renderWithProviders(<OptionTrackingPanel storeProductId={2331} productName={item.productName} option={{ id: 'o1', label: '64 GB' }} item={item} />);

    const select = screen.getByRole('combobox', { name: 'Scrape interval' });
    expect(select.textContent).toBe('Every 2 hours (default)');
    fireEvent.mouseDown(select);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Every hour', 'Every 2 hours (default)', 'Every 4 hours', 'Every 6 hours', 'Every 12 hours', 'Every 24 hours',
    ]);
    fireEvent.click(within(listbox).getByRole('option', { name: 'Every 6 hours' }));
    await waitFor(() => expect(updateTracked).toHaveBeenCalled());
    expect(vi.mocked(updateTracked).mock.calls[0].slice(0, 2)).toEqual([3, { scrapeIntervalMinutes: 360 }]);
  });
});
