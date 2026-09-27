import { addDays, addHours, format, startOfDay, startOfHour } from 'date-fns';
import { isInRange } from '../../lib/utils/timeRange';
import type { PricePoint } from '../../types/scrape';

// GET /api/tracked/:id/history takes only a limit (the newest N observations), so one request fetches the most it
// allows and the time ranges are applied here.
export const HISTORY_LIMIT = 1000;

// Every figure comes from validated observations (the endpoint returns success and retried attempts only).
type PriceSummary = {
  count: number;
  lowest: PricePoint; // the earliest one, when the lowest price was seen more than once
  highest: PricePoint;
  average: number; // mean of the observed prices, one per scrape
  first: PricePoint;
  last: PricePoint;
  changePct: number | null; // first → last observation; null with fewer than two
};

// History arrives oldest first, so the result stays in time order.
export const pointsSince = (points: PricePoint[], start: Date | null) => points.filter(point => isInRange(point.observedAt, start));

export function priceSummary(points: PricePoint[]): PriceSummary | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  let lowest = first;
  let highest = first;
  let sum = 0;
  for (const point of points) {
    if (point.price < lowest.price) lowest = point;
    if (point.price > highest.price) highest = point;
    sum += point.price;
  }
  return {
    count: points.length,
    lowest,
    highest,
    average: sum / points.length,
    first,
    last,
    changePct: points.length < 2 ? null : ((last.price - first.price) / first.price) * 100,
  };
}

// A full response means older observations were cut off, so a range reaching back past the oldest one is incomplete.
export function isHistoryCut(points: PricePoint[], start: Date | null): boolean {
  if (points.length < HISTORY_LIMIT) return false;
  return start === null || start.getTime() < new Date(points[0].observedAt).getTime();
}

const TICK_STEPS_HOURS = [1, 2, 3, 6, 12, 24, 48, 7 * 24, 14 * 24, 30 * 24];

// Evenly spaced axis ticks on round local clock times (every 3 hours, every day…), at most `max` of them.
export function timeTicks(from: number, to: number, max = 6): { ticks: number[]; label: (time: number) => string } {
  const hours = TICK_STEPS_HOURS.find(step => (to - from) / (step * 3_600_000) <= max) ?? TICK_STEPS_HOURS[TICK_STEPS_HOURS.length - 1];
  const ticks: number[] = [];
  if (hours < 24) {
    for (let time = startOfHour(from); time.getTime() <= to; time = addHours(time, 1)) {
      if (time.getTime() >= from && time.getHours() % hours === 0) ticks.push(time.getTime());
    }
    // A tick at midnight names the day, so a range that crosses it stays readable.
    return { ticks, label: time => format(time, new Date(time).getHours() === 0 ? 'd MMM' : 'HH:mm') };
  }
  const days = hours / 24;
  for (let time = startOfDay(from), i = 0; time.getTime() <= to; time = addDays(time, 1), i++) {
    if (time.getTime() >= from && i % days === 0) ticks.push(time.getTime());
  }
  return { ticks, label: time => format(time, 'd MMM') };
}
