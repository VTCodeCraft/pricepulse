import { describe, expect, it, vi } from 'vitest';
import { checkQuoteProvenance, dismissConsentWhenShown, toScrapeError } from '../src/scraper/browser.js';

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

describe('cookie consent handler', () => {
  // The handler the scraper registers with page.addLocatorHandler, run here against fake dialogs.
  async function registeredHandler(evidence) {
    let handler;
    const page = { getByRole: () => 'consent dialog locator', addLocatorHandler: async (_locator, fn) => { handler = fn; } };
    await dismissConsentWhenShown(page, evidence);
    return handler;
  }
  const dialog = ({ isVisible, click }) => ({ isVisible, getByRole: () => ({ click }) });
  const closed = new Error('locator.click: Target page, context or browser has been closed');

  it('clicks "Reject cookies" until the dialog is gone', async () => {
    const evidence = { consentClicks: 0 };
    const handler = await registeredHandler(evidence);
    const isVisible = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    await handler(dialog({ isVisible, click: vi.fn().mockResolvedValue() }));
    expect(evidence.consentClicks).toBe(2);
  });

  // Playwright does not catch errors thrown by a locator handler; a rejection here used to exit the process.
  it('resolves when the page closes mid-click or before the visibility check', async () => {
    const evidence = { consentClicks: 0 };
    const handler = await registeredHandler(evidence);
    await expect(handler(dialog({ isVisible: vi.fn().mockResolvedValue(true), click: vi.fn().mockRejectedValue(closed) }))).resolves.toBeUndefined();
    await expect(handler(dialog({ isVisible: vi.fn().mockRejectedValue(closed), click: vi.fn() }))).resolves.toBeUndefined();
    expect(evidence.consentClicks).toBe(0);
  });

  it('the scrape itself classifies a closed page as a browser crash', () => {
    expect(toScrapeError(closed)).toMatchObject({ code: 'browser_crash', message: closed.message });
  });
});
