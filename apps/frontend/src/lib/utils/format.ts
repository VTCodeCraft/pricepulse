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

// Signed amount with the same signs as percentages: +₹4,291, −₹42,103, ₹0.
export function formatSignedPrice(value: number, currency = 'INR'): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatPrice(Math.abs(value), currency)}`;
}

// Signed, one decimal: +2.4%, −12.0%, 0.0%.
export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

export const formatRelativeTime = (iso: string) => `${formatDistanceToNowStrict(new Date(iso))} ago`;

export const formatDateTime = (iso: string) => format(new Date(iso), 'd MMM yyyy, HH:mm');

// Exact instant in the browser's time zone, with the offset so it can be compared with UTC: 27 Sep 2026, 15:34:30 GMT+5:30.
export const formatTimestamp = (iso: string) => format(new Date(iso), 'd MMM yyyy, HH:mm:ss O');

// 850 ms, 17.2 s, 53 min 21 s, 1 h 5 min.
export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1_000);
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return `${Math.floor(seconds / 3_600)} h ${Math.floor((seconds % 3_600) / 60)} min`;
}
