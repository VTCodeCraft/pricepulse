// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route } from 'react-router-dom';
import { ApiError } from '../../../lib/api/client';
import { getProduct, listCatalog } from '../../../lib/api/catalog';
import { listTracked, track } from '../../../lib/api/tracked';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { CatalogPage, Product, TrackedProduct } from '../../../types/product';
import { AllProductsPage } from './AllProductsPage';

vi.mock('../../../lib/api/catalog', () => ({ listCatalog: vi.fn(), getProduct: vi.fn(), searchCatalog: vi.fn() }));
vi.mock('../../../lib/api/tracked', () => ({ listTracked: vi.fn(), track: vi.fn(), untrack: vi.fn(), scrapeTracked: vi.fn() }));

// Response shapes of GET /api/catalog/products, /api/catalog/products/:id and /api/tracked, with values the API
// returned for these products.
const prime = { storeProductId: 2331, name: 'Halvard Drawing Tablet Prime', brand: 'Halvard', category: 'Tablets', sku: 'SK-2331-HA', optionCount: 3 };
const arc = { storeProductId: 2891, name: 'Halvard Drawing Tablet Arc', brand: 'Halvard', category: 'Tablets', sku: 'SK-2891-HA', optionCount: null };
const page = (fields: Partial<CatalogPage>): CatalogPage => ({
  query: '',
  page: 1,
  pageSize: 24,
  total: 960,
  catalog: { count: 960, syncedAt: '2026-09-26T18:33:41.398Z', syncing: false },
  results: [prime, arc],
  ...fields,
});
const primeDetails: Product = {
  storeProductId: 2331,
  productUrl: 'https://demo.inelabteamdev.com/item/2331',
  name: 'Halvard Drawing Tablet Prime',
  brand: 'Halvard',
  category: 'Tablets',
  sku: 'SK-2331-HA',
  optionAxis: 'Storage',
  options: [
    { id: 'o1', label: '64 GB' },
    { id: 'o2', label: '128 GB' },
    { id: 'o3', label: '256 GB' },
  ],
  reviewSummary: null,
};
const trackedOption = (id: number, optionId: string, optionLabel: string): TrackedProduct => ({
  id,
  storeProductId: 2331,
  productUrl: 'https://demo.inelabteamdev.com/item/2331',
  productName: 'Halvard Drawing Tablet Prime',
  brand: 'Halvard',
  category: 'Tablets',
  sku: 'SK-2331-HA',
  description: null,
  optionAxis: 'Storage',
  optionId,
  optionLabel,
  options: primeDetails.options,
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
});
const tracked64 = trackedOption(3, 'o1', '64 GB');

const card = (name: string) => screen.getByRole('article', { name });

beforeEach(() => {
  vi.mocked(listCatalog).mockImplementation(async (query, pageNumber) => page({ query, page: pageNumber }));
  vi.mocked(listTracked).mockResolvedValue([tracked64]);
  vi.mocked(getProduct).mockResolvedValue(primeDetails);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = (route = '/products') =>
  renderWithProviders(<AllProductsPage />, {
    route,
    path: '/products',
    otherRoutes: <Route path="/products/:id" element={<p>Product details page</p>} />,
  });

describe('All Products', () => {
  it('shows the catalogue page the API returned', async () => {
    renderPage();
    expect(await screen.findByText('960 products in the store · page 1 of 40')).toBeTruthy();
    expect(within(card('Halvard Drawing Tablet Prime')).getByText(/ID 2331 · Halvard · Tablets/)).toBeTruthy();
    expect(within(card('Halvard Drawing Tablet Prime')).getByText('3 options')).toBeTruthy();
    expect(within(card('Halvard Drawing Tablet Arc')).queryByText(/options?$/)).toBeNull(); // count not known yet
    expect(listCatalog).toHaveBeenCalledWith('', 1, 24);
  });

  it('shows which options are tracked, per option', async () => {
    renderPage();
    expect(await within(await screen.findByRole('article', { name: 'Halvard Drawing Tablet Prime' })).findByText('Tracking 64 GB')).toBeTruthy();
    expect(within(card('Halvard Drawing Tablet Prime')).getByRole('button', { name: 'Track another option: Halvard Drawing Tablet Prime' })).toBeTruthy();
    expect(within(card('Halvard Drawing Tablet Arc')).getByText('Not tracked')).toBeTruthy();
    expect(within(card('Halvard Drawing Tablet Arc')).getByRole('button', { name: 'Track Product: Halvard Drawing Tablet Arc' })).toBeTruthy();
  });

  it('searches the whole catalogue on the server', async () => {
    vi.mocked(listCatalog).mockImplementation(async (query, pageNumber) => (query ? page({ query, page: pageNumber, total: 2 }) : page({})));
    renderPage();
    await screen.findByText('960 products in the store · page 1 of 40');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: '  drawing   tablet ' } });
    expect(await screen.findByText('2 products match “drawing tablet”')).toBeTruthy();
    expect(listCatalog).toHaveBeenLastCalledWith('drawing tablet', 1, 24);
  });

  it('pages through the catalogue on the server', async () => {
    renderPage();
    await screen.findByText('960 products in the store · page 1 of 40');
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(await screen.findByText('960 products in the store · page 2 of 40')).toBeTruthy();
    expect(listCatalog).toHaveBeenLastCalledWith('', 2, 24);
  });

  it('opens the existing tracking dialog at the option step, nothing pre-selected, tracked options disabled', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Track another option: Halvard Drawing Tablet Prime' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('radio', { name: /128 GB/ })).toBeTruthy();
    expect((within(dialog).getByRole('radio', { name: /64 GB/ }) as HTMLInputElement).disabled).toBe(true);
    expect(within(dialog).getAllByRole('radio').some(radio => (radio as HTMLInputElement).checked)).toBe(false);
    expect(getProduct).toHaveBeenCalledWith(2331);
  });

  it('tracks the chosen option through the existing flow and updates the card', async () => {
    vi.mocked(track).mockResolvedValue({ tracked: trackedOption(13, 'o2', '128 GB'), initialRun: { status: 'busy' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Track another option: Halvard Drawing Tablet Prime' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('radio', { name: /128 GB/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    vi.mocked(listTracked).mockResolvedValue([tracked64, trackedOption(13, 'o2', '128 GB')]);
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Start tracking' }));
    await waitFor(() => expect(vi.mocked(track).mock.calls[0]?.[0]).toEqual({ storeProductId: 2331, optionId: 'o2' })); // the POST /api/tracked body
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); // closes on success
    expect(await within(card('Halvard Drawing Tablet Prime')).findByText('Tracking 2 options')).toBeTruthy();
  });

  it('keeps the dialog open with the API’s message when tracking fails', async () => {
    vi.mocked(track).mockRejectedValue(new ApiError(422, 'tracking_limit_reached', 'At most 12 options can be tracked at once'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Track Product: Halvard Drawing Tablet Arc' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('radio', { name: /256 GB/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Start tracking' }));
    expect(await within(dialog).findByText('At most 12 options can be tracked at once')).toBeTruthy();
  });

  it('shows the error and retries when the catalogue cannot be loaded', async () => {
    vi.mocked(listCatalog).mockRejectedValueOnce(new ApiError(0, 'network', 'The API could not be reached'));
    renderPage();
    expect(await screen.findByText('Unable to load the products')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('960 products in the store · page 1 of 40')).toBeTruthy();
  });

  it('opens the product details page from a product', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('link', { name: 'Halvard Drawing Tablet Prime' }));
    expect(await screen.findByText('Product details page')).toBeTruthy();
  });
});
