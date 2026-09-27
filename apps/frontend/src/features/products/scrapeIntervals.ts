// The scrape intervals the server accepts (apps/server/src/scheduler/schedule.js). Slots are aligned to 00:00 UTC.
export const SCRAPE_INTERVALS = [60, 120, 240, 360, 720, 1440] as const;
export const DEFAULT_INTERVAL = 120;

export function intervalLabel(minutes: number) {
  if (minutes === 60) return 'Every hour';
  if (minutes % 60 === 0) return `Every ${minutes / 60} hours`;
  return `Every ${minutes} minutes`;
}
