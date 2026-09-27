import type { ScrapeOutcome } from './scrape';

// Shapes from apps/server/src/utils/serializers.js (trackedJson). Detail columns are null until the store was asked.

export type ProductOption = { id: string; label: string };

export type ReviewSummary = { count: number; avgRating: number };

export type TrackedProduct = {
  id: number;
  storeProductId: number;
  productUrl: string;
  productName: string;
  brand: string | null;
  category: string | null;
  sku: string | null;
  description: string | null;
  optionAxis: string | null;
  optionId: string;
  optionLabel: string;
  options: ProductOption[] | null;
  specs: Record<string, string | number> | null;
  reviewSummary: ReviewSummary | null;
  isActive: boolean;
  scrapeIntervalMinutes: number;
  nextScrapeAt: string;
  priceDropThresholdPct: number;
  lastManualScrapeAt: string | null;
  createdAt: string;
  // Latest and previous validated observation (success or retried); null until there is one.
  latest: {
    price: number;
    currency: string;
    stock: number;
    observedAt: string;
    mrp: number | null;
    memberPrice: number | null;
  } | null;
  previous: { price: number; stock: number; observedAt: string } | null;
  // The most recent finished attempt of any outcome.
  lastAttempt: { outcome: ScrapeOutcome; finishedAt: string; errorCode: string | null } | null;
};

// A row of GET /api/catalog/search, from the synced products table (brand, category and SKU may be null).
export type CatalogProduct = {
  storeProductId: number;
  name: string;
  brand: string | null;
  category: string | null;
  sku: string | null;
};

export type CatalogSearch = {
  query: string;
  catalog: { count: number; syncedAt: string | null; syncing: boolean };
  results: CatalogProduct[];
};

// GET /api/catalog/products/:id, live from the store. The store guarantees the name, option axis and at least one
// option; the other fields are passed through only when the store sends them.
export type Product = {
  storeProductId: number;
  productUrl: string;
  name: string;
  brand?: string;
  category?: string;
  sku?: string;
  description?: string;
  optionAxis: string;
  options: ProductOption[];
  specs?: Record<string, string | number>;
  reviewSummary: ReviewSummary | null;
};

export type TrackRequest = { storeProductId: number; optionId: string };

// 201 for a new option (its first scrape starts at once, or waits if another run is busy); 200 when an option that
// was untracked before is tracked again (initialRun is null).
export type TrackResponse = {
  tracked: TrackedProduct;
  initialRun: { status: 'started'; runId: number } | { status: 'busy' } | null;
};
