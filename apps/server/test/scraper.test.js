import { describe, expect, it } from 'vitest';
import { checkQuoteProvenance } from '../src/scraper.js';

const target = { productId: 2331, optionId: 'o1', since: 1_000 };
const quote = overrides => ({ at: 2_000, status: 200, pathItemId: 2331, urlOption: 'o1', itemId: 2331, option: 'o1', ...overrides });
const errorOf = fn => {
  try {
    fn();
  } catch (error) {
    return `${error.code}: ${error.message}`;
  }
  return 'no error';
};

describe('checkQuoteProvenance', () => {
  it('accepts the last quote when it matches the product and option', () => {
    expect(checkQuoteProvenance([quote({ status: 503, itemId: undefined, option: undefined }), quote()], target)).toMatchObject({ status: 200 });
  });

  it.each([
    ['a different option in the response body', quote({ option: 'o2' })],
    ['a different option in the URL', quote({ urlOption: 'o2' })],
    ['a different product', quote({ itemId: 2179, pathItemId: 2179 })],
    ['a failed last response', quote({ status: 503, itemId: undefined, option: undefined })],
  ])('rejects %s', (_label, bad) => {
    expect(errorOf(() => checkQuoteProvenance([bad], target))).toMatch(/^option_mismatch/);
  });

  it('ignores quotes from before our click', () => {
    expect(errorOf(() => checkQuoteProvenance([quote({ at: 500 })], target))).toBe('option_mismatch: no quote response was seen after our click');
  });
});
