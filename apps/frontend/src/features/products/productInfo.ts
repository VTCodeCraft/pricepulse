import type { Product, ProductOption, ReviewSummary, TrackedProduct } from '../../types/product';

export type ProductInfo = {
  name: string;
  productUrl: string;
  brand: string | null;
  category: string | null;
  sku: string | null;
  description: string | null;
  optionAxis: string | null;
  options: ProductOption[];
  specs: Record<string, string | number> | null;
  reviewSummary: ReviewSummary | null;
};

// Live details from the store when they loaded; otherwise the copy PricePulse stored when the product was tracked,
// so a store outage does not hide a tracked product.
export function productInfo(live: Product | undefined, stored: TrackedProduct | undefined): ProductInfo | null {
  if (live) {
    return {
      name: live.name,
      productUrl: live.productUrl,
      brand: live.brand ?? null,
      category: live.category ?? null,
      sku: live.sku ?? null,
      description: live.description ?? null,
      optionAxis: live.optionAxis,
      options: live.options,
      specs: live.specs ?? null,
      reviewSummary: live.reviewSummary,
    };
  }
  if (stored) {
    return {
      name: stored.productName,
      productUrl: stored.productUrl,
      brand: stored.brand,
      category: stored.category,
      sku: stored.sku,
      description: stored.description,
      optionAxis: stored.optionAxis,
      options: stored.options ?? [],
      specs: stored.specs,
      reviewSummary: stored.reviewSummary,
    };
  }
  return null;
}

// The details page is per store product; `option` picks which of its options to show.
export const productPath = (storeProductId: number, optionId?: string) =>
  optionId ? `/products/${storeProductId}?option=${optionId}` : `/products/${storeProductId}`;

// The product's active tracked options, by option id.
export function trackedOptionsOf(items: TrackedProduct[], storeProductId: number): Map<string, TrackedProduct> {
  return new Map(items.filter(item => item.storeProductId === storeProductId).map(item => [item.optionId, item]));
}

const SPEC_LABELS: Record<string, string> = { inTheBox: 'In the box', countryOfOrigin: 'Country of origin', weightGrams: 'Weight' };

// "modelYear" → "Model year"; weights in grams become "796 g" or "4.87 kg".
export function specRows(specs: Record<string, string | number>): { label: string; value: string }[] {
  return Object.entries(specs).map(([key, value]) => ({
    label: SPEC_LABELS[key] ?? humanize(key),
    value: key === 'weightGrams' && typeof value === 'number' ? formatGrams(value) : String(value),
  }));
}

const humanize = (key: string) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const formatGrams = (grams: number) => (grams < 1000 ? `${grams} g` : `${Number((grams / 1000).toFixed(2))} kg`);
