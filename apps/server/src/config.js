// Every tunable lives here and can be overridden by an environment variable.
// Defaults are sized for Render's free instance (0.15 CPU, 512 MB), measured in Phase 2.

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  return value;
}

// Only INE's mock store (or a local test server) may be scraped.
function storeBaseUrl() {
  const url = new URL(process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com');
  const allowed = url.hostname === 'demo.inelabteamdev.com' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!allowed) throw new Error(`STORE_BASE_URL must point at the INE mock store, got ${url.origin}`);
  return url.origin;
}

export const config = {
  storeBaseUrl: storeBaseUrl(),
  storeRequestGapMs: int('STORE_REQUEST_GAP_MS', 1100),
  storeTimeoutMs: int('STORE_TIMEOUT_MS', 10_000),
  storeMaxTries: int('STORE_MAX_TRIES', 3),
  storeRetryBaseDelayMs: int('STORE_RETRY_BASE_DELAY_MS', 1_000),

  headless: process.env.SCRAPER_HEADLESS !== 'false',
  // Optional installed browser ("chrome" or "msedge") instead of Playwright's bundled Chromium, e.g. for headed runs
  // on a machine that blocks the bundled binary. Production (Docker) leaves this empty.
  browserChannel: process.env.SCRAPER_BROWSER_CHANNEL || undefined,
  maxTries: int('SCRAPER_MAX_TRIES', 3),
  retryBaseDelayMs: int('SCRAPER_RETRY_BASE_DELAY_MS', 5_000),
  tryTimeoutMs: int('SCRAPER_TRY_TIMEOUT_MS', 120_000),
  navTimeoutMs: int('SCRAPER_NAV_TIMEOUT_MS', 30_000),
  quoteTimeoutMs: int('SCRAPER_QUOTE_TIMEOUT_MS', 60_000),
  pendingRechecks: int('SCRAPER_PENDING_RECHECKS', 3),
};
