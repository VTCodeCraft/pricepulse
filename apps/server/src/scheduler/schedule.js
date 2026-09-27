// Scheduling rules. Slots are multiples of the interval counted from 00:00 UTC, so a schedule never drifts:
// 120 minutes → every even UTC hour, 1440 → 00:00 UTC daily.

const MINUTE = 60_000;
export const SCRAPE_INTERVALS = [60, 120, 240, 360, 720, 1440];
export const DEFAULT_INTERVAL = 120;

// The first slot strictly after `timestamp`.
export function nextAligned(timestamp, intervalMinutes) {
  const step = intervalMinutes * MINUTE;
  return new Date((Math.floor(new Date(timestamp).getTime() / step) + 1) * step);
}

// Due when the slot has arrived. The tolerance lets a cron call that fires a little early still count.
export function isDue(nextScrapeAt, now, toleranceMinutes) {
  return new Date(nextScrapeAt).getTime() <= new Date(now).getTime() + toleranceMinutes * MINUTE;
}

// After serving the slot at `slotAt` (possibly late, possibly after missed ticks), the next slot comes after
// both the served slot and the time the scrape ran — so an overdue product runs once, not once per missed tick.
export function nextSlotAfterRun(slotAt, ranAt, intervalMinutes) {
  return nextAligned(Math.max(new Date(slotAt).getTime(), new Date(ranAt).getTime()), intervalMinutes);
}
