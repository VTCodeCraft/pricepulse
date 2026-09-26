// Database and runner tests against a real PostgreSQL database (TEST_DATABASE_URL, name must end in _test).
// Skipped when no test database is configured. The store and the browser are mocked: no network is used.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

vi.mock('../src/store.js', () => ({ getItem: vi.fn(), getManifest: vi.fn(), getListingPage: vi.fn() }));
vi.mock('../src/scraper.js', () => ({ scrapeWithRetry: vi.fn(), launchBrowser: vi.fn() }));

try {
  process.loadEnvFile(join(import.meta.dirname, '..', '.env'));
} catch {
  // no .env file: rely on the environment (CI)
}
const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL && !new URL(TEST_URL).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must name a database ending in _test');

const FIXTURES = join(import.meta.dirname, 'fixtures', 'store-api');
const item = JSON.parse(readFileSync(join(FIXTURES, 'item-2331.json'), 'utf8')); // options o1, o2, o3
const manifest = JSON.parse(readFileSync(join(FIXTURES, 'manifest-633003.json'), 'utf8'));
const HOUR = 3_600_000;

describe.skipIf(!TEST_URL)('database and runner', () => {
  let db;
  let runner;
  let store;
  let scraper;
  let layout;
  let ScrapeError;
  const sql = new pg.Client({ connectionString: TEST_URL });

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', TEST_URL);
    vi.stubEnv('RUNNER_PRODUCT_GAP_MS', '0');
    db = await import('../src/db.js');
    runner = await import('../src/runner.js');
    store = await import('../src/store.js');
    scraper = await import('../src/scraper.js');
    layout = await import('../src/layout.js');
    ({ ScrapeError } = await import('../src/retry.js'));
    await sql.connect();
    await sql.query('drop table if exists alerts, scrape_attempts, layout_versions, scrape_runs, tracked_products, products, schema_migrations cascade');
  });

  afterAll(async () => {
    await sql.end();
    await db?.closeDb();
    vi.unstubAllEnvs();
  });

  describe('migrations', () => {
    it('apply once, in order, and create every table', async () => {
      expect(await db.migrate()).toEqual(['001_init.sql']);
      expect(await db.migrate()).toEqual([]);
      const { rows } = await sql.query("select tablename from pg_tables where schemaname = 'public' order by tablename");
      expect(rows.map(r => r.tablename)).toEqual(['alerts', 'layout_versions', 'products', 'schema_migrations', 'scrape_attempts', 'scrape_runs', 'tracked_products']);
      const rls = await sql.query("select count(*)::int as n from pg_tables where schemaname = 'public' and rowsecurity");
      expect(rls.rows[0].n).toBe(7);
    });
  });

  describe('with a clean schema', () => {
    beforeEach(async () => {
      await sql.query('truncate alerts, scrape_attempts, layout_versions, scrape_runs, tracked_products, products restart identity cascade');
      vi.clearAllMocks();
      await db.upsertProduct(item);
    });

    const track = (optionId, nextScrapeAt) => sql.query(
      'insert into tracked_products (store_product_id, option_id, option_label, next_scrape_at) values (2331, $1, $2, $3) returning id',
      [optionId, `label ${optionId}`, nextScrapeAt],
    ).then(r => r.rows[0].id);
    const newRun = () => sql.query("insert into scrape_runs (trigger) values ('cli') returning id").then(r => r.rows[0].id);
    const rejects = (text, params, pattern) => expect(sql.query(text, params)).rejects.toThrow(pattern);

    describe('constraints', () => {
      const insertAttempt = 'insert into scrape_attempts (run_id, tracked_product_id, outcome, finished_at, price, currency, stock) values ($1, $2, $3, $4, $5, $6, $7)';

      it('a failed attempt cannot carry a price or stock', async () => {
        const [runId, trackedId] = [await newRun(), await track('o1', new Date())];
        await rejects(insertAttempt, [runId, trackedId, 'failed', new Date(), 90313, 'INR', 141], /observation_matches_outcome/);
        await rejects(insertAttempt, [runId, trackedId, 'failed', new Date(), null, null, 0], /observation_matches_outcome/);
      });

      it('a successful or retried attempt must carry price, stock and currency', async () => {
        const [runId, trackedId] = [await newRun(), await track('o1', new Date())];
        await rejects(insertAttempt, [runId, trackedId, 'success', new Date(), null, null, null], /observation_matches_outcome/);
        await rejects(insertAttempt, [runId, trackedId, 'retried', new Date(), 90313, 'INR', null], /observation_matches_outcome/);
        await sql.query(insertAttempt, [runId, trackedId, 'success', new Date(), 90313, 'INR', 141]);
      });

      it('an in-progress attempt has neither an outcome nor an observation', async () => {
        const [runId, trackedId] = [await newRun(), await track('o1', new Date())];
        await rejects(insertAttempt, [runId, trackedId, null, null, 90313, 'INR', 141], /observation_matches_outcome/);
        await rejects(insertAttempt, [runId, trackedId, 'success', null, 90313, 'INR', 141], /check constraint/);
      });

      it('rejects impossible values', async () => {
        const [runId, trackedId] = [await newRun(), await track('o1', new Date())];
        await rejects(insertAttempt, [runId, trackedId, 'success', new Date(), 0, 'INR', 1], /check constraint/);
        await rejects(insertAttempt, [runId, trackedId, 'success', new Date(), 10, 'INR', -1], /check constraint/);
        await rejects(insertAttempt, [runId, trackedId, 'success', new Date(), 10, 'inr', 1], /check constraint/);
        await rejects('update tracked_products set scrape_interval_minutes = 90 where id = $1', [trackedId], /check constraint/);
        await rejects("insert into tracked_products (store_product_id, option_id, option_label) values (2331, 'x1', 'x')", [], /check constraint/);
      });

      it('a product + option can only be tracked once', async () => {
        await track('o1', new Date());
        await rejects("insert into tracked_products (store_product_id, option_id, option_label) values (2331, 'o1', 'again')", [], /unique/);
      });
    });

    describe('tracked products', () => {
      it('defaults to a 120-minute interval and re-activates instead of duplicating', async () => {
        const first = await db.addTrackedProduct({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB' });
        expect(first).toMatchObject({ scrape_interval_minutes: 120, is_active: true });
        await sql.query('update tracked_products set is_active = false where id = $1', [first.id]);
        expect(await db.listActiveTracked()).toHaveLength(0);
        const again = await db.addTrackedProduct({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB' });
        expect(again.id).toBe(first.id);
        expect((await db.listActiveTracked())[0]).toMatchObject({ id: first.id, product_name: item.name, option_axis: 'Storage' });
      });

      it('changing the interval re-aligns the next scrape', async () => {
        const tracked = await db.addTrackedProduct({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB' });
        const next = new Date('2026-09-27T00:00:00Z');
        await db.setScrapeInterval(tracked.id, 1440, next);
        const [row] = await db.getTrackedByIds([tracked.id]);
        expect(row).toMatchObject({ scrape_interval_minutes: 1440, next_scrape_at: next });
      });

      it('stores product details once, shared by every option', async () => {
        const { rows } = await sql.query('select name, option_axis, options, review_summary from products where store_product_id = 2331');
        expect(rows[0]).toMatchObject({ name: item.name, option_axis: 'Storage', options: item.options });
        expect(rows[0].review_summary.count).toBe(item.reviews.length);
      });
    });

    describe('run lock and reaper', () => {
      it('only one run can be running at a time', async () => {
        const first = await db.startRun({ trigger: 'cron', host: 'test' });
        expect(first.status).toBe('running');
        expect(await db.startRun({ trigger: 'manual', host: 'test' })).toBeNull();
        await db.finishRun(first.id, { status: 'completed' });
        expect(await db.startRun({ trigger: 'manual', host: 'test' })).not.toBeNull();
      });

      it('closes a run whose heartbeat stopped and fails its unfinished attempts', async () => {
        const trackedId = await track('o1', new Date());
        const stale = (await sql.query("insert into scrape_runs (trigger, heartbeat_at) values ('cron', now() - interval '20 minutes') returning id")).rows[0].id;
        await db.startAttempt(stale, trackedId);
        expect(await db.reapStaleRuns(15)).toEqual([stale]);
        const run = (await sql.query('select status, finished_at from scrape_runs where id = $1', [stale])).rows[0];
        expect(run.status).toBe('abandoned');
        const attempt = (await sql.query('select outcome, error_code, price, stock from scrape_attempts where run_id = $1', [stale])).rows[0];
        expect(attempt).toEqual({ outcome: 'failed', error_code: 'interrupted', price: null, stock: null });
      });

      it('leaves a long but live run alone: only a stopped heartbeat counts as stale', async () => {
        const longRun = (await sql.query("insert into scrape_runs (trigger, started_at, heartbeat_at) values ('cron', now() - interval '2 hours', now()) returning id")).rows[0].id;
        expect(await db.reapStaleRuns(15)).toEqual([]);
        await db.touchRun(longRun);
        expect((await sql.query('select status from scrape_runs where id = $1', [longRun])).rows[0].status).toBe('running');
      });
    });

    describe('layout versions and alerts', () => {
      it('records each manifest once and counts sightings', async () => {
        const version = { manifestHash: 'abc', schemaHash: 'def', revision: 633003, variant: 3, manifest, supported: true };
        const id = await db.recordLayoutVersion(version);
        expect(await db.recordLayoutVersion(version)).toBe(id);
        expect((await sql.query('select seen_count from layout_versions where id = $1', [id])).rows[0].seen_count).toBe(2);
      });

      it('alerts each event once', async () => {
        const alert = { type: 'price_drop', severity: 'info', dedupeKey: 'attempt-1', title: 'Price drop', message: '₹90,313 → ₹85,000' };
        expect(await db.insertAlert(alert)).toMatchObject({ type: 'price_drop', read_at: null, email_status: 'not_configured' });
        expect(await db.insertAlert(alert)).toBeNull();
        expect(await db.insertAlert({ ...alert, dedupeKey: 'attempt-2' })).not.toBeNull();
      });
    });

    describe('runner', () => {
      const scraped = (optionId, overrides = {}) => ({
        outcome: 'success',
        tries: [{ tryNumber: 1, ok: true }],
        result: {
          productId: 2331,
          productName: item.name,
          optionId,
          optionLabel: optionId,
          price: 90313,
          currency: 'INR',
          stock: 141,
          displayed: { price: '₹90,313', stock: 'Last few: 141' },
          layout: { revision: manifest.revision, variant: manifest.variant, manifestHash: layout.hashManifest(manifest), schemaHash: layout.hashSchema(manifest) },
          evidence: { storeFailures: 0, pendingRechecks: 0, decoys: { mrp: ['₹2,15,031'], memberPrice: ['Member price ₹1,52,672'], hiddenPriceValue: [], hiddenAmount: [] } },
          timingsMs: {},
        },
        ...overrides,
      });

      beforeEach(() => {
        store.getItem.mockResolvedValue(item);
        store.getManifest.mockResolvedValue(manifest);
        scraper.launchBrowser.mockResolvedValue({ isConnected: () => true, close: async () => {} });
        scraper.scrapeWithRetry.mockImplementation(async ({ optionId }) => scraped(optionId));
      });

      const attemptsFor = trackedId => sql.query('select * from scrape_attempts where tracked_product_id = $1', [trackedId]).then(r => r.rows);
      const nextScrapeAt = trackedId => sql.query('select next_scrape_at from tracked_products where id = $1', [trackedId]).then(r => r.rows[0].next_scrape_at);

      it('scrapes only due options, stores the validated observation, and advances the slot', async () => {
        const due = await track('o1', new Date(Date.now() - 60_000));
        const notDue = await track('o2', new Date(Date.now() + 5 * HOUR));
        const run = await runner.runTick({ trigger: 'cron' });
        expect(run).toMatchObject({ status: 'completed', due: 1, success: 1, retried: 0, failed: 0 });

        const [attempt] = await db.listAttempts(due);
        expect(attempt).toMatchObject({ outcome: 'success', price: '90313.00', currency: 'INR', stock: 141, tries: 1, layout_revision: 633003 });
        expect(attempt.extras).toEqual({ mrp: 215031, memberPrice: 152672 });
        expect(attempt.layout_version_id).not.toBeNull();
        expect(await attemptsFor(notDue)).toHaveLength(0);

        const next = await nextScrapeAt(due);
        expect(next.getTime()).toBeGreaterThan(Date.now());
        expect(next.getUTCHours() % 2 + next.getUTCMinutes()).toBe(0);
      });

      it('records a failed scrape honestly, with no price or stock', async () => {
        const trackedId = await track('o1', new Date());
        scraper.scrapeWithRetry.mockResolvedValue({
          outcome: 'failed',
          tries: [{ ok: false }, { ok: false }, { ok: false }],
          error: new ScrapeError('store_gave_up', 'store page gave up: upstream 503'),
        });
        expect(await runner.runTick({ trigger: 'cron' })).toMatchObject({ status: 'completed', failed: 1 });
        const [attempt] = await attemptsFor(trackedId);
        expect(attempt).toMatchObject({ outcome: 'failed', price: null, stock: null, currency: null, tries: 3, error_code: 'store_gave_up' });
      });

      it('fails an option the store no longer offers without opening a browser', async () => {
        const trackedId = await track('o4', new Date());
        await runner.runTick({ trigger: 'cron' });
        expect((await attemptsFor(trackedId))[0]).toMatchObject({ outcome: 'failed', error_code: 'option_not_found' });
        expect(scraper.scrapeWithRetry).not.toHaveBeenCalled();
      });

      it('fails every option of a product whose preflight fails', async () => {
        const trackedId = await track('o1', new Date());
        store.getItem.mockRejectedValue(new ScrapeError('store_http_error', 'GET /api/v2/items/2331 returned 503'));
        await runner.runTick({ trigger: 'cron' });
        expect((await attemptsFor(trackedId))[0]).toMatchObject({ outcome: 'failed', error_code: 'store_http_error', price: null });
      });

      it('records a browser that cannot start as that attempt\'s failure', async () => {
        const trackedId = await track('o1', new Date());
        scraper.launchBrowser.mockRejectedValue(new ScrapeError('browser_launch_failed', 'spawn UNKNOWN'));
        expect(await runner.runTick({ trigger: 'cron' })).toMatchObject({ status: 'completed', failed: 1 });
        expect((await attemptsFor(trackedId))[0]).toMatchObject({ outcome: 'failed', error_code: 'browser_launch_failed', price: null });
      });

      it('records a heartbeat run when nothing is due', async () => {
        await track('o1', new Date(Date.now() + 5 * HOUR));
        const run = await runner.runTick({ trigger: 'cron' });
        expect(run).toMatchObject({ status: 'completed', due: 0 });
        const row = (await sql.query('select status, products_due from scrape_runs where id = $1', [run.runId])).rows[0];
        expect(row).toEqual({ status: 'completed', products_due: 0 });
        expect(scraper.launchBrowser).not.toHaveBeenCalled();
      });

      it('an overdue option runs once and returns to its schedule', async () => {
        const trackedId = await track('o1', new Date(Date.now() - 10 * HOUR));
        await runner.runTick({ trigger: 'cron' });
        const next = await nextScrapeAt(trackedId);
        expect(next.getTime() - Date.now()).toBeLessThanOrEqual(2 * HOUR);
        await runner.runTick({ trigger: 'cron' });
        expect(await attemptsFor(trackedId)).toHaveLength(1);
      });

      it('force scrapes every active option but does not move future slots', async () => {
        const future = new Date(Date.now() + 5 * HOUR);
        const trackedId = await track('o2', future);
        expect(await runner.runTick({ trigger: 'cli', force: true })).toMatchObject({ due: 1, success: 1 });
        expect((await nextScrapeAt(trackedId)).getTime()).toBe(future.getTime());
      });

      it('does not start while another run holds the lock', async () => {
        await track('o1', new Date());
        await db.startRun({ trigger: 'manual', host: 'test' });
        expect(await runner.runTick({ trigger: 'cron' })).toEqual({ status: 'busy' });
        expect(scraper.scrapeWithRetry).not.toHaveBeenCalled();
      });

      it('two ticks at the same moment: one runs, the other is refused', async () => {
        await track('o1', new Date());
        scraper.scrapeWithRetry.mockImplementation(async ({ optionId }) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return scraped(optionId);
        });
        const results = await Promise.all([runner.runTick({ trigger: 'cron' }), runner.runTick({ trigger: 'cron' })]);
        expect(results.map(r => r.status).sort()).toEqual(['busy', 'completed']);
      });

      it('clears a stale run first, then runs', async () => {
        await track('o1', new Date());
        const stale = (await sql.query("insert into scrape_runs (trigger, heartbeat_at) values ('cron', now() - interval '1 hour') returning id")).rows[0].id;
        expect(await runner.runTick({ trigger: 'cron' })).toMatchObject({ status: 'completed', success: 1 });
        expect((await sql.query('select status from scrape_runs where id = $1', [stale])).rows[0].status).toBe('abandoned');
      });
    });
  });
});
