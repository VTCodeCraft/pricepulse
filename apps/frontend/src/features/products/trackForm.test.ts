import { describe, expect, it } from 'vitest';
import type { TrackResponse } from '../../types/product';
import { firstScrapeNote, trackFormSchema } from './trackForm';

const options = [
  { id: 'o1', label: '64 GB' },
  { id: 'o2', label: '128 GB' },
  { id: 'o3', label: '256 GB' },
];

describe('trackFormSchema', () => {
  it('produces exactly the POST /api/tracked payload, one or several options', () => {
    const schema = trackFormSchema(options, new Set());
    expect(schema.safeParse({ storeProductId: 2331, optionIds: ['o2'] }).data).toEqual({ storeProductId: 2331, optionIds: ['o2'] });
    expect(schema.safeParse({ storeProductId: 2331, optionIds: ['o1', 'o3'] }).data).toEqual({ storeProductId: 2331, optionIds: ['o1', 'o3'] });
  });

  it('requires an explicit choice; nothing is chosen by default', () => {
    const result = trackFormSchema(options, new Set()).safeParse({ storeProductId: 2331, optionIds: [] });
    expect(result.error?.issues[0].message).toBe('Choose at least one option to track');
  });

  it('rejects an option that does not belong to the product', () => {
    const result = trackFormSchema(options, new Set()).safeParse({ storeProductId: 2331, optionIds: ['o1', 'o9'] });
    expect(result.error?.issues[0].message).toBe('Choose among this product’s options');
  });

  it('rejects an option that is already tracked', () => {
    const result = trackFormSchema(options, new Set(['o3'])).safeParse({ storeProductId: 2331, optionIds: ['o2', 'o3'] });
    expect(result.error?.issues[0].message).toBe('An option you chose is already being tracked');
  });
});

describe('firstScrapeNote', () => {
  const response = (count: number, initialRun: TrackResponse['initialRun']) => ({ tracked: Array(count).fill({}), initialRun }) as TrackResponse;

  it('explains when the first prices come, for one or several options', () => {
    expect(firstScrapeNote(response(1, { status: 'started', runId: 5 }))).toBe('The first price usually arrives within a minute.');
    expect(firstScrapeNote(response(3, { status: 'started', runId: 5 }))).toMatch(/^The first prices arrive/);
    expect(firstScrapeNote(response(2, { status: 'busy' }))).toBe('Another scrape is running; the first prices come with the next run.');
    expect(firstScrapeNote(response(1, null))).toBe('Tracked again; its earlier price history continues.');
  });
});
