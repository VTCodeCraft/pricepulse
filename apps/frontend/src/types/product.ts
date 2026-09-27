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
