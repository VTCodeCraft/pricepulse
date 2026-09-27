// API tests over real HTTP against a real PostgreSQL database (TEST_DATABASE_URL, name must end in _test).
// Skipped when no test database is configured. The store and the browser are mocked: no network is used.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

vi.mock('../src/scraper/store.js', () => ({ getItem: vi.fn(), getManifest: vi.fn(), getListingPage: vi.fn() }));
vi.mock('../src/scraper/browser.js', () => ({ scrapeWithRetry: vi.fn(), launchBrowser: vi.fn() }));

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
const SECRET = 'test-cron-secret';
const FRONTEND = 'https://frontend.test';

describe.skipIf(!TEST_URL)('HTTP API', () => {
  const sql = new pg.Client({ connectionString: TEST_URL });
  let server;
  let base;
  let client, migrations, products, trackedProducts, layoutVersions, alerts;
  let store;
  let scraper;
  let ScrapeError;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', TEST_URL);
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('CORS_ORIGINS', FRONTEND);
    vi.stubEnv('MAX_TRACKED', '3');
    vi.stubEnv('RUNNER_PRODUCT_GAP_MS', '0');
    client = await import('../src/db/client.js');
    migrations = await import('../src/db/migrate.js');
    products = await import('../src/db/repositories/products.repository.js');
    trackedProducts = await import('../src/db/repositories/tracked-products.repository.js');
    layoutVersions = await import('../src/db/repositories/layout-versions.repository.js');
    alerts = await import('../src/db/repositories/alerts.repository.js');
    store = await import('../src/scraper/store.js');
    scraper = await import('../src/scraper/browser.js');
    ({ ScrapeError } = await import('../src/scraper/retry.js'));
    const { createApp } = await import('../src/app.js');
    await sql.connect();
    await sql.query('drop table if exists alerts, scrape_attempts, layout_versions, scrape_runs, tracked_products, products, schema_migrations cascade');
    await migrations.migrate();
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  afterAll(async () => {
    server?.close();
    await sql.end();
    await client?.closeDb();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await sql.query('truncate alerts, scrape_attempts, layout_versions, scrape_runs, tracked_products, products restart identity cascade');
    vi.clearAllMocks();
    store.getItem.mockImplementation(async id => {
      if (id === 2331) return item;
      throw new ScrapeError('product_not_found', `product ${id} does not exist in the store`);
    });
    store.getManifest.mockResolvedValue(manifest);
    scraper.launchBrowser.mockResolvedValue({ isConnected: () => true, close: async () => {} });
    scraper.scrapeWithRetry.mockImplementation(async ({ optionId }) => scraped(optionId));
  });

  const scraped = optionId => ({
    outcome: 'success',
    tries: [{ tryNumber: 1, ok: true }],
    result: {
      productId: 2331, productName: item.name, optionId, optionLabel: optionId, price: 90313, currency: 'INR', stock: 141,
      displayed: { price: '₹90,313', stock: 'Last few: 141' },
      layout: { revision: manifest.revision, variant: manifest.variant, manifestHash: 'h1', schemaHash: 's1' },
      evidence: { storeFailures: 0, pendingRechecks: 0, decoys: { mrp: ['₹2,15,031'], memberPrice: [], hiddenPriceValue: [], hiddenAmount: [] } },
      timingsMs: {},
    },
  });

  async function api(method, path, body, headers = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, headers: response.headers, body: json, text };
  }

  async function waitForRun(runId) {
    for (let i = 0; i < 100; i++) {
      const { body } = await api('GET', `/runs/${runId}`);
      if (body.run.status !== 'running') return body;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`run ${runId} did not finish`);
  }

  const track = async (optionId = 'o1', extra = {}) => {
    const response = await api('POST', '/tracked', { storeProductId: 2331, optionId, ...extra });
    if (response.body.initialRun?.runId) await waitForRun(response.body.initialRun.runId);
    return response;
  };

  // Inserts a finished attempt directly, for history/CSV tests that need exact data.
  async function addAttempt(trackedId, { outcome, price = null, stock = null, minutesAgo }) {
    const runId = (await sql.query("insert into scrape_runs (trigger, status, finished_at) values ('cron', 'completed', now()) returning id")).rows[0].id;
    await sql.query(
      `insert into scrape_attempts (run_id, tracked_product_id, started_at, finished_at, outcome, price, currency, stock, tries)
       values ($1, $2, now() - make_interval(mins => $3), now() - make_interval(mins => $3), $4, $5, $6, $7, 1)`,
      [runId, trackedId, minutesAgo, outcome, price, price === null ? null : 'INR', stock],
    );
  }

  describe('basics', () => {
    it('reports health, the database and applied migrations', async () => {
      const { status, body } = await api('GET', '/health');
      expect(status).toBe(200);
      expect(body).toMatchObject({ ok: true, database: { status: 'ok', migrations: ['001_init.sql', '002_catalog_synced_at_nullable.sql'] } });
    });

    it('answers unknown routes and broken JSON with JSON errors', async () => {
      expect(await api('GET', '/nope')).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } });
      expect(await api('POST', '/tracked', '{broken')).toMatchObject({ status: 400, body: { error: { code: 'invalid_json' } } });
    });

    it('sends CORS headers only to the configured frontend', async () => {
      expect((await api('GET', '/runs', undefined, { origin: FRONTEND })).headers.get('access-control-allow-origin')).toBe(FRONTEND);
      expect((await api('GET', '/runs', undefined, { origin: 'https://evil.test' })).headers.get('access-control-allow-origin')).toBeNull();
      const preflight = await api('OPTIONS', '/tracked/1', undefined, { origin: FRONTEND, 'access-control-request-method': 'PATCH' });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-methods')).toContain('PATCH');
    });
  });

  describe('catalogue', () => {
    it('starts a sync when the catalogue is empty, then searches by partial name', async () => {
      store.getListingPage.mockResolvedValue({
        page: 1, perPage: 3, totalPages: 1, count: 3,
        results: [
          { id: 2331, name: 'Halvard Drawing Tablet Prime', slug: 's', brand: 'Halvard', category: 'Tablets', sku: 'SK-2331-HA', description: '' },
          { id: 2891, name: 'Halvard Drawing Tablet Arc', slug: 's', brand: 'Halvard', category: 'Tablets', sku: 'SK-2891-HA', description: '' },
          { id: 2948, name: 'Redwick Electronic Drum Kit Arc', slug: 's', brand: 'Redwick', category: 'Instruments', sku: 'SK-2948-RE', description: '' },
        ],
      });
      expect(await api('GET', '/catalog/search?q=tablet')).toMatchObject({ status: 503, body: { error: { code: 'catalog_syncing' } } });
      let result;
      for (let i = 0; i < 50 && result?.status !== 200; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        result = await api('GET', '/catalog/search?q=halvard%20arc');
      }
      expect(result.body.results.map(r => r.storeProductId)).toEqual([2891]);
      expect((await api('GET', '/catalog/search?q=drawing')).body.results.map(r => r.name)).toEqual(['Halvard Drawing Tablet Arc', 'Halvard Drawing Tablet Prime']);
      expect((await api('GET', '/catalog/search?q=halvard%20d')).body.results[0].name).toMatch(/^Halvard D/);
    });

    it('validates the query', async () => {
      expect((await api('GET', '/catalog/search?q=a')).status).toBe(400);
      expect((await api('GET', '/catalog/search?q=tablet&limit=500')).status).toBe(400);
    });

    it('returns live product details with options', async () => {
      const { status, body } = await api('GET', '/catalog/products/2331');
      expect(status).toBe(200);
      expect(body).toMatchObject({ storeProductId: 2331, optionAxis: 'Storage', options: item.options, productUrl: 'https://demo.inelabteamdev.com/item/2331' });
      expect(body.reviewSummary.count).toBe(item.reviews.length);
    });

    it('maps missing products and store failures', async () => {
      expect(await api('GET', '/catalog/products/99999')).toMatchObject({ status: 404, body: { error: { code: 'product_not_found' } } });
      store.getItem.mockRejectedValueOnce(new ScrapeError('store_http_error', 'GET /api/v2/items/2331 returned 503'));
      expect(await api('GET', '/catalog/products/2331')).toMatchObject({ status: 502, body: { error: { code: 'store_unavailable' } } });
      expect((await api('GET', '/catalog/products/abc')).status).toBe(400);
    });

    const seedCatalog = async () => {
      await products.upsertCatalogProducts([
        { id: 2331, name: 'Halvard Drawing Tablet Prime', slug: 's', brand: 'Halvard', category: 'Tablets', sku: 'SK-2331-HA', description: '' },
        { id: 2891, name: 'Halvard Drawing Tablet Arc', slug: 's', brand: 'Halvard', category: 'Tablets', sku: 'SK-2891-HA', description: '' },
        { id: 2948, name: 'Redwick Electronic Drum Kit Arc', slug: 's', brand: 'Redwick', category: 'Instruments', sku: 'SK-2948-RE', description: '' },
      ]);
    };

    it('lists the whole catalogue a page at a time, with the matching total', async () => {
      await seedCatalog();
      await api('GET', '/catalog/products/2331'); // fetching the details stores the options
      const first = await api('GET', '/catalog/products?page=1&pageSize=2');
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ query: '', page: 1, pageSize: 2, total: 3, catalog: { count: 3 } });
      // Option counts are known once a product's details were fetched; listings carry none.
      expect(first.body.results).toEqual([
        { storeProductId: 2891, name: 'Halvard Drawing Tablet Arc', brand: 'Halvard', category: 'Tablets', sku: 'SK-2891-HA', optionCount: null },
        { storeProductId: 2331, name: 'Halvard Drawing Tablet Prime', brand: 'Halvard', category: 'Tablets', sku: 'SK-2331-HA', optionCount: item.options.length },
      ]);
      expect((await api('GET', '/catalog/products?page=2&pageSize=2')).body.results.map(r => r.storeProductId)).toEqual([2948]);
      expect((await api('GET', '/catalog/products?page=3&pageSize=2')).body).toMatchObject({ total: 3, results: [] });
    });

    it('filters the listing by name with the same matching as search', async () => {
      await seedCatalog();
      expect((await api('GET', '/catalog/products?q=halvard')).body).toMatchObject({ query: 'halvard', total: 2 });
      expect((await api('GET', '/catalog/products?q=drum%20arc')).body.results.map(r => r.storeProductId)).toEqual([2948]);
      expect((await api('GET', '/catalog/products?q=100%25')).body).toMatchObject({ total: 0, results: [] });
    });

    it('validates the listing parameters', async () => {
      expect((await api('GET', '/catalog/products?q=a')).status).toBe(400);
      expect((await api('GET', '/catalog/products?pageSize=61')).status).toBe(400);
      expect((await api('GET', '/catalog/products?page=0')).status).toBe(400);
    });
  });

  describe('tracking', () => {
    it('tracks a new option (201) and scrapes it straight away', async () => {
      const { status, body } = await track('o1', { priceDropThresholdPct: 7.5 });
      expect(status).toBe(201);
      expect(body.tracked).toMatchObject({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB', scrapeIntervalMinutes: 120, priceDropThresholdPct: 7.5 });
      expect(body.initialRun.status).toBe('started');
      const detail = (await api('GET', `/tracked/${body.tracked.id}`)).body.tracked;
      expect(detail.latest).toMatchObject({ price: 90313, currency: 'INR', stock: 141, mrp: 215031 });
    });

    it('re-tracking returns 200, the same row, and no second initial scrape', async () => {
      const first = (await track('o1')).body.tracked;
      const again = await api('POST', '/tracked', { storeProductId: 2331, optionId: 'o1' });
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ tracked: { id: first.id }, initialRun: null });
    });

    it.each([
      [{ optionId: 'o1' }, 'storeProductId'],
      [{ storeProductId: 'abc', optionId: 'o1' }, 'storeProductId'],
      [{ storeProductId: 2331 }, 'optionId'],
      [{ storeProductId: 2331, optionId: 'x1' }, 'optionId'],
      [{ storeProductId: 2331, optionId: 'o1', scrapeIntervalMinutes: 90 }, 'scrapeIntervalMinutes'],
      [{ storeProductId: 2331, optionId: 'o1', priceDropThresholdPct: 0 }, 'priceDropThresholdPct'],
      [{ storeProductId: 2331, optionId: 'o1', colour: 'red' }, 'colour'],
      [{ storeProductId: 2331, optionId: 'o1', optionIds: ['o2'] }, 'optionIds'],
      [{ storeProductId: 2331, optionIds: [] }, 'optionIds'],
      [{ storeProductId: 2331, optionIds: ['o1', 'o1'] }, 'optionIds'],
      [{ storeProductId: 2331, optionIds: ['o1', 'x1'] }, 'optionId'],
    ])('rejects %j', async (body, field) => {
      const response = await api('POST', '/tracked', body);
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(field);
    });

    it('rejects unknown products and options', async () => {
      expect(await api('POST', '/tracked', { storeProductId: 99999, optionId: 'o1' })).toMatchObject({ status: 404, body: { error: { code: 'product_not_found' } } });
      expect(await api('POST', '/tracked', { storeProductId: 2331, optionId: 'o9' })).toMatchObject({ status: 422, body: { error: { code: 'option_not_found' } } });
    });

    it('tracks several options of a product in one request, with one first-scrape run for all', async () => {
      const { status, body } = await api('POST', '/tracked', { storeProductId: 2331, optionIds: ['o1', 'o3'] });
      expect(status).toBe(201);
      expect(body.tracked.map(t => t.optionLabel)).toEqual(['64 GB', '256 GB']);
      const run = await waitForRun(body.initialRun.runId);
      expect(run.run).toMatchObject({ trigger: 'initial', productsDue: 2 });
      expect(run.attempts.map(a => a.optionLabel)).toEqual(['64 GB', '256 GB']);
    });

    it('scrapes only the new options of a request; re-tracked ones join without a second first scrape', async () => {
      await track('o1');
      const { status, body } = await api('POST', '/tracked', { storeProductId: 2331, optionIds: ['o1', 'o2'] });
      expect(status).toBe(201);
      expect((await waitForRun(body.initialRun.runId)).attempts.map(a => a.optionLabel)).toEqual(['128 GB']);
      expect(await api('POST', '/tracked', { storeProductId: 2331, optionIds: ['o1', 'o2'] })).toMatchObject({ status: 200, body: { initialRun: null } });
    });

    it('tracks none of the options when one is unknown', async () => {
      expect(await api('POST', '/tracked', { storeProductId: 2331, optionIds: ['o1', 'o9'] })).toMatchObject({ status: 422, body: { error: { code: 'option_not_found' } } });
      expect((await api('GET', '/tracked')).body.items).toEqual([]);
    });

    it('applies the tracking limit to the whole request', async () => {
      for (const option of ['o1', 'o2']) await track(option);
      // Already tracked options do not count again: 2 tracked + 1 new = 3, the limit.
      expect((await api('POST', '/tracked', { storeProductId: 2331, optionIds: ['o1', 'o2', 'o3'] })).status).toBe(201);
      await api('DELETE', `/tracked/${(await api('GET', '/tracked')).body.items[2].id}`);
      const extra = { ...item, id: 2335, options: [{ id: 'o1', label: 'x' }, { id: 'o2', label: 'y' }] };
      store.getItem.mockResolvedValue(extra);
      // 2 tracked + 2 new = 4: refused as a whole, nothing added.
      expect(await api('POST', '/tracked', { storeProductId: 2335, optionIds: ['o1', 'o2'] })).toMatchObject({ status: 422, body: { error: { code: 'tracking_limit_reached' } } });
      expect((await api('GET', '/tracked')).body.items).toHaveLength(2);
    });

    it('enforces the tracking limit', async () => {
      for (const option of ['o1', 'o2', 'o3']) await track(option);
      const extra = { ...item, id: 2335, options: [{ id: 'o1', label: 'x' }] };
      store.getItem.mockResolvedValue(extra);
      expect(await api('POST', '/tracked', { storeProductId: 2335, optionId: 'o1' })).toMatchObject({ status: 422, body: { error: { code: 'tracking_limit_reached' } } });
    });

    it('updates settings and re-aligns the next scrape', async () => {
      const { id } = (await track('o1')).body.tracked;
      const { status, body } = await api('PATCH', `/tracked/${id}`, { scrapeIntervalMinutes: 1440, priceDropThresholdPct: 12 });
      expect(status).toBe(200);
      expect(body.tracked).toMatchObject({ scrapeIntervalMinutes: 1440, priceDropThresholdPct: 12 });
      expect(new Date(body.tracked.nextScrapeAt).toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect((await api('PATCH', `/tracked/${id}`, {})).status).toBe(400);
      expect((await api('PATCH', `/tracked/${id}`, { isActive: 'no' })).status).toBe(400);
      expect((await api('PATCH', '/tracked/999', { isActive: false })).status).toBe(404);
    });

    it('untracks without deleting history', async () => {
      const { id } = (await track('o1')).body.tracked;
      expect((await api('DELETE', `/tracked/${id}`)).status).toBe(204);
      expect((await api('GET', '/tracked')).body.items).toHaveLength(0);
      expect((await api('GET', '/tracked?includeInactive=true')).body.items[0]).toMatchObject({ id, isActive: false });
      expect((await api('GET', `/tracked/${id}/history`)).body.observations).toHaveLength(1);
      expect((await api('DELETE', '/tracked/999')).status).toBe(404);
    });
  });

  describe('history, scrape log and CSV', () => {
    let trackedId;
    beforeEach(async () => {
      await products.upsertProduct({ ...item, name: 'Halvard Drawing Tablet, "Prime"' });
      trackedId = (await trackedProducts.addTrackedProduct({ storeProductId: 2331, optionId: 'o1', optionLabel: '64 GB' })).id;
      await addAttempt(trackedId, { outcome: 'success', price: 100000, stock: 5, minutesAgo: 240 });
      await addAttempt(trackedId, { outcome: 'retried', price: 90313, stock: 0, minutesAgo: 120 });
      await addAttempt(trackedId, { outcome: 'failed', minutesAgo: 1 });
    });

    it('the overview shows the latest and previous observation and the last attempt', async () => {
      const [tracked] = (await api('GET', '/tracked')).body.items;
      expect(tracked.latest).toMatchObject({ price: 90313, stock: 0 });
      expect(tracked.previous).toMatchObject({ price: 100000, stock: 5 });
      expect(tracked.lastAttempt.outcome).toBe('failed');
    });

    it('history has validated observations only, oldest first', async () => {
      const { observations } = (await api('GET', `/tracked/${trackedId}/history`)).body;
      expect(observations.map(o => [o.price, o.stock, o.outcome])).toEqual([[100000, 5, 'success'], [90313, 0, 'retried']]);
    });

    it('the scrape log has every attempt, newest first, failures with no price', async () => {
      const { attempts } = (await api('GET', `/tracked/${trackedId}/attempts`)).body;
      expect(attempts.map(a => a.outcome)).toEqual(['failed', 'retried', 'success']);
      expect(attempts[0]).toMatchObject({ price: null, stock: null, trigger: 'cron' });
    });

    it('exports every attempt as CSV with the required columns', async () => {
      const { status, headers, text } = await api('GET', '/export.csv');
      expect(status).toBe(200);
      expect(headers.get('content-type')).toContain('text/csv');
      expect(headers.get('content-disposition')).toMatch(/^attachment; filename="pricepulse-scrape-history-.*\.csv"$/);
      const lines = text.trim().split('\r\n');
      expect(lines[0]).toBe('store_product_id,product_name,selected_option,timestamp,price,stock,outcome');
      expect(lines).toHaveLength(4);
      expect(lines[1]).toMatch(/^2331,"Halvard Drawing Tablet, ""Prime""",64 GB,\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z,100000\.00,5,success$/);
      expect(lines[3]).toMatch(/,,,failed$/);
    });
  });

  describe('scraping', () => {
    it('a manual scrape answers 202, runs in the background, then enforces a cooldown', async () => {
      const { id } = (await track('o1')).body.tracked;
      const started = await api('POST', `/tracked/${id}/scrape`);
      expect(started).toMatchObject({ status: 202, body: { status: 'started' } });
      const finished = await waitForRun(started.body.runId);
      expect(finished.run).toMatchObject({ trigger: 'manual', status: 'completed', success: 1 });
      const again = await api('POST', `/tracked/${id}/scrape`);
      expect(again).toMatchObject({ status: 429, body: { error: { code: 'cooldown' } } });
      expect(again.body.error.details.retryAfterSeconds).toBeGreaterThan(500);
    });

    it('refuses a manual scrape for an untracked option and while another run is going', async () => {
      const { id } = (await track('o1')).body.tracked;
      const running = (await sql.query("insert into scrape_runs (trigger) values ('cron') returning id")).rows[0].id;
      expect(await api('POST', `/tracked/${id}/scrape`)).toMatchObject({ status: 409, body: { error: { code: 'run_in_progress', details: { runningRunId: running } } } });
      await sql.query("update scrape_runs set status = 'completed', finished_at = now() where id = $1", [running]);
      await api('DELETE', `/tracked/${id}`);
      expect(await api('POST', `/tracked/${id}/scrape`)).toMatchObject({ status: 409, body: { error: { code: 'not_active' } } });
    });

    it('the cron endpoint needs the secret', async () => {
      expect((await api('POST', '/scrape/run')).status).toBe(401);
      expect((await api('POST', '/scrape/run', {}, { authorization: 'Bearer wrong' })).status).toBe(401);
      const { status, body } = await api('POST', '/scrape/run', {}, { authorization: `Bearer ${SECRET}` });
      expect(status).toBe(202);
      expect((await waitForRun(body.runId)).run).toMatchObject({ trigger: 'cron', status: 'completed', productsDue: 0 });
    });

    it('two cron calls at once: one starts, the other gets 409', async () => {
      await track('o1');
      await sql.query("update tracked_products set next_scrape_at = now() - interval '1 minute'");
      scraper.scrapeWithRetry.mockImplementation(async ({ optionId }) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return scraped(optionId);
      });
      const auth = { authorization: `Bearer ${SECRET}` };
      const responses = await Promise.all([api('POST', '/scrape/run', {}, auth), api('POST', '/scrape/run', {}, auth)]);
      expect(responses.map(r => r.status).sort()).toEqual([202, 409]);
      await waitForRun(responses.find(r => r.status === 202).body.runId);
    });

    it('a run whose process died does not block the cron call or a manual scrape', async () => {
      const { id } = (await track('o1')).body.tracked;
      const deadRun = () => sql.query("insert into scrape_runs (trigger, heartbeat_at) values ('cron', now() - interval '20 minutes') returning id");
      const dead = (await deadRun()).rows[0].id;
      const cron = await api('POST', '/scrape/run', {}, { authorization: `Bearer ${SECRET}` });
      expect(cron.status).toBe(202);
      await waitForRun(cron.body.runId);
      expect((await api('GET', `/runs/${dead}`)).body.run).toMatchObject({ status: 'abandoned' });

      await deadRun();
      const manual = await api('POST', `/tracked/${id}/scrape`);
      expect(manual.status).toBe(202);
      await waitForRun(manual.body.runId);
    });

    it('lists runs and shows one run with its attempts', async () => {
      const { initialRun } = (await track('o1')).body;
      expect((await api('GET', '/runs')).body.runs[0]).toMatchObject({ id: initialRun.runId, trigger: 'initial' });
      const detail = await api('GET', `/runs/${initialRun.runId}`);
      expect(detail.body.attempts[0]).toMatchObject({ storeProductId: 2331, optionLabel: '64 GB', outcome: 'success', price: 90313 });
      expect((await api('GET', '/runs/999')).status).toBe(404);
    });
  });

  describe('alerts and layout', () => {
    it('lists alerts, filters unread and marks them read', async () => {
      const a = await alerts.insertAlert({ type: 'price_drop', severity: 'info', dedupeKey: 'a1', title: 'Price drop', message: '100000 → 90313' });
      await alerts.insertAlert({ type: 'back_in_stock', severity: 'info', dedupeKey: 'b1', title: 'Back in stock', message: '0 → 5' });
      expect((await api('GET', '/alerts')).body.alerts).toHaveLength(2);
      expect((await api('POST', `/alerts/${a.id}/read`)).body.alert.readAt).not.toBeNull();
      expect((await api('GET', '/alerts?unread=true')).body.alerts.map(x => x.type)).toEqual(['back_in_stock']);
      expect((await api('POST', '/alerts/read-all')).body).toEqual({ updated: 1 });
      expect((await api('POST', '/alerts/999/read')).status).toBe(404);
    });

    it('shows layout versions and structure alerts only', async () => {
      await layoutVersions.recordLayoutVersion({ manifestHash: 'h1', schemaHash: 's1', revision: 633003, variant: 3, manifest, supported: true });
      await alerts.insertAlert({ type: 'structure_changed', severity: 'warning', dedupeKey: 's1', title: 'Store layout changed', message: 'new key' });
      await alerts.insertAlert({ type: 'price_drop', severity: 'info', dedupeKey: 'p1', title: 'Price drop', message: 'x' });
      const { body } = await api('GET', '/layout');
      expect(body.versions[0]).toMatchObject({ revision: 633003, supported: true, seenCount: 1 });
      expect(body.alerts.map(x => x.type)).toEqual(['structure_changed']);
    });
  });
});
