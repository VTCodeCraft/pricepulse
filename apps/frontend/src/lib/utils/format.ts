import { format, formatDistanceToNowStrict } from 'date-fns';

const formatters = new Map<string, Intl.NumberFormat>();

// en-IN grouping: 117570 → ₹1,17,570.
export function formatPrice(value: number, currency = 'INR'): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 });
    formatters.set(currency, formatter);
  }
  return formatter.format(value);
}

// Signed, one decimal: +2.4%, −12.0%, 0.0%.
export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

export const formatRelativeTime = (iso: string) => `${formatDistanceToNowStrict(new Date(iso))} ago`;

export const formatDateTime = (iso: string) => format(new Date(iso), 'd MMM yyyy, HH:mm');
