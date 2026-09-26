// Error type, retry policy, and outcome rules for scraping one product option.

export class ScrapeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ScrapeError';
    this.code = code;
    this.details = details;
  }
}

// A retry cannot fix these: the store says the product/option does not exist, or it rejected our request.
const PERMANENT = new Set(['product_not_found', 'option_not_found', 'store_rejected']);

export const isRetryable = error => !PERMANENT.has(error.code);

// Delay before the next try: base, 3×base, 9×base… with ±20 % jitter so retries don't line up.
export function retryDelayMs(failedTry, baseMs, random = Math.random) {
  return Math.round(baseMs * 3 ** (failedTry - 1) * (0.8 + random() * 0.4));
}

// success: valid data on the first try and no failure seen anywhere.
// retried: valid data, but only after our retry, the store page's own retry, or a pending price we re-checked.
// failed: no valid data.
export function deriveOutcome(tries, result) {
  if (!result) return 'failed';
  const { storeFailures, pendingRechecks } = result.evidence;
  return tries.length > 1 || storeFailures > 0 || pendingRechecks > 0 ? 'retried' : 'success';
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runWithRetry(attempt, { maxTries, baseDelayMs, wait = sleep, random, onRetry }) {
  const tries = [];
  for (let tryNumber = 1; ; tryNumber++) {
    const startedAt = Date.now();
    try {
      const result = await attempt(tryNumber);
      tries.push({ tryNumber, ok: true, ms: Date.now() - startedAt });
      return { outcome: deriveOutcome(tries, result), result, tries };
    } catch (thrown) {
      const error = thrown instanceof ScrapeError ? thrown : new ScrapeError('unexpected', thrown.message);
      tries.push({ tryNumber, ok: false, code: error.code, message: error.message, ms: Date.now() - startedAt });
      if (!isRetryable(error) || tryNumber >= maxTries) return { outcome: 'failed', error, tries };
      const delayMs = retryDelayMs(tryNumber, baseDelayMs, random);
      onRetry?.({ tryNumber, error, delayMs });
      await wait(delayMs);
    }
  }
}
