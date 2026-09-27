// Database and runner tests against a real PostgreSQL database (TEST_DATABASE_URL, name must end in _test).
// Skipped when no test database is configured. The store and the browser are mocked: no network is used.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

vi.mock('../src/scraper/store.js', () => ({ getItem: vi.fn(), getManifest: vi.fn(), getListingPage: vi.fn() }));
vi.mock('../src/scraper/browser.js', () => ({ scrapeWithRetry: vi.fn(), launchBrowser: vi.fn(), openProductSession: vi.fn() }));

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
  let client, migrations, products, trackedProducts, runs, attempts, layoutVersions, alerts;
  let runner;
  let store;
  let scraper;
  let layout;
  let ScrapeError;
  const sql = new pg.Client({ connectionString: TEST_URL });

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', TEST_URL);
    vi.stubEnv('RUNNER_PRODUCT_GAP_MS', '0');
    client = await import('../src/db/client.js');
    migrations = await import('../src/db/migrate.js');
    products = await import('../src/db/repositories/products.repository.js');
    trackedProducts = await import('../src/db/repositories/tracked-products.repository.js');
    runs = await import('../src/db/repositories/scrape-runs.repository.js');
    attempts = await import('../src/db/repositories/scrape-attempts.repository.js');
    layoutVersions = await import('../src/db/repositories/layout-versions.repository.js');
    alerts = await import('../src/db/repositories/alerts.repository.js');
    runner = await import('../src/scheduler/runner.js');
    store = await import('../src/scraper/store.js');
    scraper = await import('../src/scraper/browser.js');
    layout = await import('../src/scraper/layout.js');
    ({ ScrapeError } = await import('../src/scraper/retry.js'));
    await sql.connect();
    await sql.query('drop table if exists alerts, scrape_attempts, layout_versions, scrape_runs, tracked_products, products, schema_migrations cascade');
  });

  afterAll(async () => {
    await sql.end();
    await client?.closeDb();
    vi.unstubAllEnvs();
  });

  describe('migrations', () => {
    it('apply once, in order, and create every table', async () => {
      expect(await migrations.migrate()).toEqual(['001_init.sql', '002_catalog_synced_at_nullable.sql', '003_page_structure.sql']);
      expect(await migrations.migrate()).toEqual([]);
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
      await products.upsertProduct(item);
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
        const first = await trackedProducts.addTrackedProduct({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB' });
        expect(first).toMatchObject({ scrape_interval_minutes: 120, is_active: true });
        await sql.query('update tracked_products set is_active = false where id = $1', [first.id]);
        expect(await trackedProducts.listActiveTracked()).toHaveLength(0);
        const again = await trackedProducts.addTrackedProduct({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB' });
        expect(again.id).toBe(first.id);
        expect((await trackedProducts.listActiveTracked())[0]).toMatchObject({ id: first.id, product_name: item.name, option_axis: 'Storage' });
      });

      it('changing the interval re-aligns the next scrape', async () => {
        const tracked = await trackedProducts.addTrackedProduct({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB' });
        const next = new Date('2026-09-27T00:00:00Z');
        await trackedProducts.updateTracked(tracked.id, { intervalMinutes: 1440, nextScrapeAt: next });
        const [row] = await trackedProducts.getTrackedByIds([tracked.id]);
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
        const first = await runs.startRun({ trigger: 'cron', host: 'test' });
        expect(first.status).toBe('running');
        expect(await runs.startRun({ trigger: 'manual', host: 'test' })).toBeNull();
        await runs.finishRun(first.id, { status: 'completed' });
        expect(await runs.startRun({ trigger: 'manual', host: 'test' })).not.toBeNull();
      });

      it('closes a run whose heartbeat stopped and fails its unfinished attempts', async () => {
        const trackedId = await track('o1', new Date());
        const stale = (await sql.query("insert into scrape_runs (trigger, heartbeat_at) values ('cron', now() - interval '20 minutes') returning id")).rows[0].id;
        await attempts.startAttempt(stale, trackedId);
        expect(await runs.reapStaleRuns(15)).toEqual([stale]);
        const run = (await sql.query('select status, finished_at from scrape_runs where id = $1', [stale])).rows[0];
        expect(run.status).toBe('abandoned');
        const attempt = (await sql.query('select outcome, error_code, price, stock from scrape_attempts where run_id = $1', [stale])).rows[0];
        expect(attempt).toEqual({ outcome: 'failed', error_code: 'interrupted', price: null, stock: null });
      });

      it('leaves a long but live run alone: only a stopped heartbeat counts as stale', async () => {
        const longRun = (await sql.query("insert into scrape_runs (trigger, started_at, heartbeat_at) values ('cron', now() - interval '2 hours', now()) returning id")).rows[0].id;
        expect(await runs.reapStaleRuns(15)).toEqual([]);
        await runs.touchRun(longRun);
        expect((await sql.query('select status from scrape_runs where id = $1', [longRun])).rows[0].status).toBe('running');
      });
    });

    describe('layout versions and alerts', () => {
      it('records each manifest once and counts sightings', async () => {
        const version = { manifestHash: 'abc', schemaHash: 'def', revision: 633003, variant: 3, manifest, supported: true };
        const id = await layoutVersions.recordLayoutVersion(version);
        expect(await layoutVersions.recordLayoutVersion(version)).toBe(id);
        expect((await sql.query('select seen_count from layout_versions where id = $1', [id])).rows[0].seen_count).toBe(2);
      });

      it('alerts each event once', async () => {
        const alert = { type: 'price_drop', severity: 'info', dedupeKey: 'attempt-1', title: 'Price drop', message: '₹90,313 → ₹85,000' };
        expect(await alerts.insertAlert(alert)).toMatchObject({ type: 'price_drop', read_at: null, email_status: 'not_configured' });
        expect(await alerts.insertAlert(alert)).toBeNull();
        expect(await alerts.insertAlert({ ...alert, dedupeKey: 'attempt-2' })).not.toBeNull();
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
        const browser = { isConnected: () => true, close: async () => {} };
        scraper.launchBrowser.mockResolvedValue(browser);
        scraper.openProductSession.mockImplementation(async () => ({ browser: () => browser, close: vi.fn(async () => {}) }));
        scraper.scrapeWithRetry.mockImplementation(async ({ optionId }) => scraped(optionId));
      });

      const attemptsFor = trackedId => sql.query('select * from scrape_attempts where tracked_product_id = $1', [trackedId]).then(r => r.rows);
      const nextScrapeAt = trackedId => sql.query('select next_scrape_at from tracked_products where id = $1', [trackedId]).then(r => r.rows[0].next_scrape_at);

      it('scrapes only due options, stores the validated observation, and advances the slot', async () => {
        const due = await track('o1', new Date(Date.now() - 60_000));
        const notDue = await track('o2', new Date(Date.now() + 5 * HOUR));
        const run = await runner.runTick({ trigger: 'cron' });
        expect(run).toMatchObject({ status: 'completed', due: 1, success: 1, retried: 0, failed: 0 });

        const [attempt] = await attempts.listAttempts(due);
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
        await runs.startRun({ trigger: 'manual', host: 'test' });
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

      it('alerts on a price drop and a return to stock, comparing validated observations only', async () => {
        const trackedId = await track('o1', new Date());
        const observe = (price, stock) => scraper.scrapeWithRetry.mockImplementationOnce(async ({ optionId }) => {
          const result = scraped(optionId);
          return { ...result, result: { ...result.result, price, stock } };
        });
        const alertRows = () => sql.query('select type, severity, attempt_id, data from alerts order by id').then(r => r.rows);

        observe(100000, 0);
        await runner.runTick({ trigger: 'cli', force: true }); // first observation: nothing to compare with
        scraper.scrapeWithRetry.mockResolvedValueOnce({ outcome: 'failed', tries: [{ ok: false }], error: new ScrapeError('timeout', 'slow') });
        await runner.runTick({ trigger: 'cli', force: true }); // a failed attempt is not an observation
        expect(await alertRows()).toEqual([]);

        observe(90000, 5);
        await runner.runTick({ trigger: 'cli', force: true }); // compared with the first run, not the failed one
        const [, , third] = await attempts.listAttempts(trackedId).then(rows => rows.reverse());
        expect(await alertRows()).toEqual([
          expect.objectContaining({ type: 'price_drop', severity: 'warning', attempt_id: third.id, data: expect.objectContaining({ previousPrice: 100000, currentPrice: 90000, change: -10000, changePct: -10, optionId: 'o1' }) }),
          expect.objectContaining({ type: 'back_in_stock', attempt_id: third.id, data: expect.objectContaining({ previousStock: 0, currentStock: 5 }) }),
        ]);

        observe(90000, 5);
        await runner.runTick({ trigger: 'cli', force: true }); // unchanged
        observe(95000, 7);
        await runner.runTick({ trigger: 'cli', force: true }); // a rise
        expect(await alertRows()).toHaveLength(2);
      });

      it('compares the page structure of every successful scrape and alerts once when it changes', async () => {
        await track('o1', new Date());
        const withStructure = (hash, price) => scraper.scrapeWithRetry.mockImplementationOnce(async ({ optionId }) => {
          const result = scraped(optionId);
          const signature = { price: price ?? ['div.offer-row', 'priceValue'], stock: ['div.offer-facts', 'stock'] };
          return { ...result, result: { ...result.result, layout: { ...result.result.layout, structure: { hash, signature } } } };
        });
        const structureAlerts = () => sql.query("select data from alerts where type = 'structure_changed'").then(r => r.rows);

        withStructure('aaaa');
        await runner.runTick({ trigger: 'cli', force: true }); // first seen
        withStructure('aaaa');
        await runner.runTick({ trigger: 'cli', force: true }); // unchanged
        expect(await structureAlerts()).toEqual([]);
        expect((await layoutVersions.latestStructure()).structure_hash).toBe('aaaa');

        withStructure('bbbb', ['div.offer-row', 'div.price-box', 'priceValue']);
        await runner.runTick({ trigger: 'cli', force: true });
        withStructure('bbbb', ['div.offer-row', 'div.price-box', 'priceValue']);
        await runner.runTick({ trigger: 'cli', force: true });
        expect(await structureAlerts()).toEqual([{ data: expect.objectContaining({ changed: ['price'], previousHash: 'aaaa', currentHash: 'bbbb' }) }]);
        expect((await layoutVersions.latestStructure()).structure_hash).toBe('bbbb');
      });

      it('each option returns to its own interval: hourly, six-hourly and the 120-minute default', async () => {
        const [hourly, sixHourly, standard] = [await track('o1', new Date()), await track('o2', new Date()), await track('o3', new Date())];
        await sql.query('update tracked_products set scrape_interval_minutes = 60 where id = $1', [hourly]);
        await sql.query('update tracked_products set scrape_interval_minutes = 360 where id = $1', [sixHourly]);
        expect(await runner.runTick({ trigger: 'cron' })).toMatchObject({ due: 3, success: 3 });

        const now = Date.now();
        const slot = async (id, minutes) => {
          const next = (await nextScrapeAt(id)).getTime();
          expect(next % (minutes * 60_000)).toBe(0); // aligned to the interval, counted from 00:00 UTC
          expect(next).toBeGreaterThan(now);
          expect(next).toBeLessThanOrEqual(now + minutes * 60_000);
        };
        await slot(hourly, 60);
        await slot(sixHourly, 360);
        await slot(standard, 120);
      });

      it('scrapes every option of a product in one run and one session, each on its own', async () => {
        const [o1, o2, o3] = [await track('o1', new Date()), await track('o2', new Date()), await track('o3', new Date())];
        scraper.scrapeWithRetry.mockImplementation(async ({ optionId }) => {
          if (optionId === 'o2') return { outcome: 'failed', tries: [{ ok: false }, { ok: false }, { ok: false }], error: new ScrapeError('timeout', 'slow') };
          const result = scraped(optionId);
          return { ...result, result: { ...result.result, price: { o1: 90313, o3: 126406 }[optionId] } };
        });
        const run = await runner.runTick({ trigger: 'cron' });
        expect(run).toMatchObject({ status: 'completed', due: 3, success: 2, failed: 1 });

        expect(scraper.openProductSession).toHaveBeenCalledTimes(1);
        const session = await scraper.openProductSession.mock.results[0].value;
        expect(scraper.scrapeWithRetry.mock.calls.map(([target, options]) => [target, options.session])).toEqual([
          [{ productId: 2331, optionId: 'o1' }, session],
          [{ productId: 2331, optionId: 'o2' }, session],
          [{ productId: 2331, optionId: 'o3' }, session],
        ]);
        expect(session.close).toHaveBeenCalledTimes(1);

        const rows = (await sql.query('select run_id, tracked_product_id, outcome, price from scrape_attempts order by tracked_product_id')).rows;
        expect(rows).toEqual([
          { run_id: run.runId, tracked_product_id: o1, outcome: 'success', price: '90313.00' },
          { run_id: run.runId, tracked_product_id: o2, outcome: 'failed', price: null },
          { run_id: run.runId, tracked_product_id: o3, outcome: 'success', price: '126406.00' },
        ]);
      });

      it('never stores a result against a different option than the one scraped', async () => {
        const trackedId = await track('o1', new Date());
        scraper.scrapeWithRetry.mockResolvedValue(scraped('o2'));
        expect(await runner.runTick({ trigger: 'cron' })).toMatchObject({ failed: 1 });
        expect(await attemptsFor(trackedId)).toEqual([expect.objectContaining({ outcome: 'failed', price: null, error_code: 'option_mismatch' })]);
      });

      it('the same observation never alerts twice', async () => {
        const trackedId = await track('o1', new Date());
        const runId = await newRun();
        const attemptId = await attempts.startAttempt(runId, trackedId);
        const [tracked] = await trackedProducts.getTrackedByIds([trackedId]);
        const { recordObservationAlerts } = await import('../src/services/alerts.service.js');
        const change = {
          tracked,
          attemptId,
          previous: { outcome: 'success', price: '100.00', currency: 'INR', stock: 0 },
          current: { outcome: 'success', price: 90, currency: 'INR', stock: 3 },
        };
        expect(await recordObservationAlerts(change)).toHaveLength(2);
        expect(await recordObservationAlerts(change)).toHaveLength(0);
        expect((await sql.query('select count(*)::int as n from alerts')).rows[0].n).toBe(2);
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
