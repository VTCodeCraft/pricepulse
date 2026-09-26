import { describe, expect, it, vi } from 'vitest';
import { ScrapeError, deriveOutcome, isRetryable, retryDelayMs, runWithRetry } from '../src/retry.js';

const cleanResult = { evidence: { storeFailures: 0, pendingRechecks: 0 } };
const options = wait => ({ maxTries: 3, baseDelayMs: 5_000, wait, random: () => 0.5 });

describe('isRetryable', () => {
  it.each(['product_not_found', 'option_not_found', 'store_rejected'])('%s is permanent', code => {
    expect(isRetryable(new ScrapeError(code, ''))).toBe(false);
  });

  it.each([
    'timeout', 'network', 'store_http_error', 'malformed_response', 'store_gave_up', 'selector_missing',
    'selector_ambiguous', 'parse_error', 'option_mismatch', 'pending_price', 'unlock_failed', 'click_ignored',
    'layout_changed', 'browser_crash', 'unexpected',
  ])('%s is retried', code => {
    expect(isRetryable(new ScrapeError(code, ''))).toBe(true);
  });
});

describe('retryDelayMs', () => {
  it('grows 3× per try', () => {
    expect([1, 2, 3].map(n => retryDelayMs(n, 5_000, () => 0.5))).toEqual([5_000, 15_000, 45_000]);
  });

  it('adds ±20 % jitter', () => {
    expect(retryDelayMs(1, 5_000, () => 0)).toBe(4_000);
    expect(retryDelayMs(1, 5_000, () => 1)).toBe(6_000);
  });
});

describe('deriveOutcome', () => {
  const tries = n => Array.from({ length: n }, (_, i) => ({ tryNumber: i + 1 }));

  it.each([
    ['success', tries(1), cleanResult],
    ['retried', tries(2), cleanResult],
    ['retried', tries(1), { evidence: { storeFailures: 1, pendingRechecks: 0 } }],
    ['retried', tries(1), { evidence: { storeFailures: 0, pendingRechecks: 1 } }],
    ['failed', tries(3), undefined],
  ])('%s', (expected, tryList, result) => {
    expect(deriveOutcome(tryList, result)).toBe(expected);
  });
});

describe('runWithRetry', () => {
  it('returns success after one clean try without waiting', async () => {
    const sleep = vi.fn();
    const run = await runWithRetry(async () => cleanResult, options(sleep));
    expect(run.outcome).toBe('success');
    expect(run.tries).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a transient failure and reports "retried"', async () => {
    const sleep = vi.fn();
    const attempt = vi.fn()
      .mockRejectedValueOnce(new ScrapeError('store_gave_up', 'Couldn’t load the price after 6 attempts'))
      .mockResolvedValueOnce(cleanResult);
    const run = await runWithRetry(attempt, options(sleep));
    expect(run.outcome).toBe('retried');
    expect(run.tries.map(t => t.ok)).toEqual([false, true]);
    expect(sleep).toHaveBeenCalledWith(5_000);
  });

  it('does not retry a permanent error', async () => {
    const sleep = vi.fn();
    const attempt = vi.fn().mockRejectedValue(new ScrapeError('option_not_found', 'no o9'));
    const run = await runWithRetry(attempt, options(sleep));
    expect(run).toMatchObject({ outcome: 'failed', error: { code: 'option_not_found' } });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('gives up after maxTries and never returns a result', async () => {
    const sleep = vi.fn();
    const attempt = vi.fn().mockRejectedValue(new ScrapeError('pending_price', 'still refreshing'));
    const run = await runWithRetry(attempt, options(sleep));
    expect(run.outcome).toBe('failed');
    expect(run.result).toBeUndefined();
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([5_000, 15_000]);
  });

  it('wraps unexpected errors so they are logged with a code', async () => {
    const run = await runWithRetry(async () => { throw new TypeError('boom'); }, { ...options(vi.fn()), maxTries: 1 });
    expect(run.error).toMatchObject({ code: 'unexpected', message: 'boom' });
  });
});
