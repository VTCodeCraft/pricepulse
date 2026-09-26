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

  databaseUrl: process.env.DATABASE_URL,
  // A cron call a few minutes early still serves the slot.
  schedulerToleranceMinutes: int('SCHEDULER_TOLERANCE_MINUTES', 5),
  // A 'running' run whose heartbeat is older than this is treated as dead (the process restarted mid-run).
  staleRunMinutes: int('STALE_RUN_MINUTES', 15),
  // Pause between products in one run, to stay polite to the store.
  productGapMs: int('RUNNER_PRODUCT_GAP_MS', 4_000),

  // API
  // Browser origins allowed to call the API (the Vercel frontend, local Vite).
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(origin => origin.trim()).filter(Boolean),
  // Shared secret for the cron and admin endpoints (Authorization: Bearer ...). Those endpoints are off without it.
  cronSecret: process.env.CRON_SECRET || undefined,
  manualScrapeCooldownMinutes: int('MANUAL_SCRAPE_COOLDOWN_MINUTES', 10),
  maxTracked: int('MAX_TRACKED', 12),
};
