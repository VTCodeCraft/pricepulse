import type { BadgeStatus } from '../../components/common/StatusBadge';
import type { TrackedProduct } from '../../types/product';

// The store reports a count, and 0 when sold out. It gives no "low stock" signal, so none is derived here.
export function stockStatus(stock: number | null | undefined): BadgeStatus {
  if (stock === null || stock === undefined) return 'unknown';
  return stock > 0 ? 'inStock' : 'outOfStock';
}

// Change from the previous validated observation to the latest; null until an option has two.
export function priceChangePct({ latest, previous }: Pick<TrackedProduct, 'latest' | 'previous'>): number | null {
  if (!latest || !previous) return null;
  return ((latest.price - previous.price) / previous.price) * 100;
}
