import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = join(import.meta.dirname, 'fixtures', 'store-api');
const item = readFileSync(join(API, 'item-2331.json'), 'utf8');
const nginx503 = readFileSync(join(API, 'error-nginx-503.html'), 'utf8');
const json = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

let store;
beforeAll(async () => {
  vi.stubEnv('STORE_REQUEST_GAP_MS', '0');
  vi.stubEnv('STORE_RETRY_BASE_DELAY_MS', '0');
  store = await import('../src/store.js'); // config reads the env at import time
});
afterEach(() => vi.unstubAllGlobals());

const stubFetch = (...responses) => {
  const fetch = vi.fn();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

describe('store client', () => {
  it('returns a valid product', async () => {
    stubFetch(json(item));
    expect(await store.getItem(2331)).toMatchObject({ id: 2331, optionAxis: 'Storage' });
  });

  it('treats a 404 as a permanent "product_not_found" without retrying', async () => {
    const fetch = stubFetch(json('{"error":"not_found"}', 404));
    await expect(store.getItem(99999)).rejects.toMatchObject({ code: 'product_not_found' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries the nginx HTML 503 and a 429, then succeeds', async () => {
    const fetch = stubFetch(new Response(nginx503, { status: 503, headers: { 'content-type': 'text/html' } }), json('{"error":"rate_limited"}', 429), json(item));
    expect(await store.getItem(2331)).toMatchObject({ id: 2331 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rejects a 200 that is not JSON or has the wrong shape', async () => {
    const html = () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    stubFetch(html(), html(), html());
    await expect(store.getItem(2331)).rejects.toMatchObject({ code: 'malformed_response' });
    stubFetch(json('{"id":2331}'), json('{"id":2331}'), json('{"id":2331}'));
    await expect(store.getItem(2331)).rejects.toMatchObject({ code: 'malformed_response' });
  });
});
