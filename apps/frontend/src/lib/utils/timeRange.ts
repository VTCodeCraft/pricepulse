import { subHours } from 'date-fns';

// Ranges are exact durations counted back from now (7D = 168 hours), not calendar days in the browser's time zone,
// so a daylight-saving change cannot stretch or shrink them. Timestamps are compared as instants (UTC).
export const TIME_RANGES = [
  { value: '24h', label: '24H', hours: 24, description: 'the last 24 hours' },
  { value: '7d', label: '7D', hours: 7 * 24, description: 'the last 7 days' },
  { value: '30d', label: '30D', hours: 30 * 24, description: 'the last 30 days' },
  { value: '90d', label: '90D', hours: 90 * 24, description: 'the last 90 days' },
  { value: 'all', label: 'All', hours: null, description: 'all time' },
] as const;

export type TimeRange = (typeof TIME_RANGES)[number]['value'];

export const timeRange = (value: TimeRange) => TIME_RANGES.find(range => range.value === value) ?? TIME_RANGES[4];

// The earliest instant inside the range, or null for "all".
export function rangeStart(value: TimeRange, now: Date): Date | null {
  const { hours } = timeRange(value);
  return hours === null ? null : subHours(now, hours);
}

export const isInRange = (iso: string, start: Date | null) => start === null || new Date(iso).getTime() >= start.getTime();
