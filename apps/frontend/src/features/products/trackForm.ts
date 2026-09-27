import { z } from 'zod';
import type { ProductOption, TrackResponse } from '../../types/product';

// UX checks before POST /api/tracked; the backend still validates the product and option against the store.
export function trackFormSchema(options: ProductOption[], trackedOptionIds: ReadonlySet<string>) {
  return z.object({
    storeProductId: z.number().int().positive(),
    optionId: z
      .string()
      .min(1, 'Choose an option to track')
      .refine(id => id === '' || options.some(option => option.id === id), 'Choose one of this product’s options')
      .refine(id => !trackedOptionIds.has(id), 'This option is already being tracked'),
  });
}

export type TrackFormValues = z.infer<ReturnType<typeof trackFormSchema>>;

// What happens next, from the POST /api/tracked answer.
export function firstScrapeNote({ initialRun }: TrackResponse): string {
  if (initialRun === null) return 'Tracked again; its earlier price history continues.';
  if (initialRun.status === 'busy') return 'Another scrape is running; the first price comes with the next run.';
  return 'The first price usually arrives within a minute.';
}
