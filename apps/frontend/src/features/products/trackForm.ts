import { z } from 'zod';
import type { ProductOption, TrackResponse } from '../../types/product';

// UX checks before POST /api/tracked; the backend still validates the product and option against the store.
export function trackFormSchema(options: ProductOption[], trackedOptionIds: ReadonlySet<string>) {
  return z.object({
    storeProductId: z.number().int().positive(),
    optionIds: z
      .array(z.string())
      .min(1, 'Choose at least one option to track')
      .refine(ids => ids.every(id => options.some(option => option.id === id)), 'Choose among this product’s options')
      .refine(ids => ids.every(id => !trackedOptionIds.has(id)), 'An option you chose is already being tracked'),
  });
}

export type TrackFormValues = z.infer<ReturnType<typeof trackFormSchema>>;

// What happens next, from the POST /api/tracked answer.
export function firstScrapeNote({ tracked, initialRun }: TrackResponse): string {
  const several = tracked.length > 1;
  if (initialRun === null) return `Tracked again; ${several ? 'their' : 'its'} earlier price history continues.`;
  if (initialRun.status === 'busy') return `Another scrape is running; the first ${several ? 'prices come' : 'price comes'} with the next run.`;
  return several ? 'The first prices arrive over the next few minutes, one option after another.' : 'The first price usually arrives within a minute.';
}
