// HTTP client for the store's plain JSON endpoints (catalog, product details, layout manifest).
// Requests are spaced out and retried on transient failures; the store rate-limits bursts (429, then nginx 503 HTML).
import { config } from './config.js';
import { validateManifest } from './layout.js';
import { ScrapeError, retryDelayMs, sleep } from './retry.js';

let nextSlotAt = 0;

// Reserve the next request slot synchronously, so concurrent callers still end up spaced out.
async function waitForSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + config.storeRequestGapMs;
  if (slot > now) await sleep(slot - now);
}

export async function getItem(productId) {
  try {
    return await getJson(`/api/v2/items/${productId}`, isItem);
  } catch (error) {
    if (error.code === 'not_found') throw new ScrapeError('product_not_found', `product ${productId} does not exist in the store`);
    throw error;
  }
}

export const getListingPage = (page, limit) => getJson(`/api/v2/listings?page=${page}&limit=${limit}`, isListingPage);

export const getManifest = () => getJson('/api/v2/ui/manifest', body => validateManifest(body).valid);

async function getJson(path, isValid) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await requestOnce(path, isValid);
    } catch (error) {
      const transient = ['timeout', 'network', 'store_http_error', 'malformed_response'].includes(error.code);
      if (!transient || attempt >= config.storeMaxTries) throw error;
      await sleep(Math.max(error.details.retryAfterMs ?? 0, retryDelayMs(attempt, config.storeRetryBaseDelayMs)));
    }
  }
}

async function requestOnce(path, isValid) {
  await waitForSlot();
  let response;
  try {
    response = await fetch(config.storeBaseUrl + path, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(config.storeTimeoutMs),
    });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    throw new ScrapeError(timedOut ? 'timeout' : 'network', `GET ${path} failed: ${error.cause?.code ?? error.message}`);
  }

  const { status } = response;
  if (status === 404) throw new ScrapeError('not_found', `GET ${path} returned 404`);
  if (status === 429 || status >= 500) {
    const retryAfterMs = Number(response.headers.get('retry-after')) * 1000 || 0;
    throw new ScrapeError('store_http_error', `GET ${path} returned ${status}`, { status, retryAfterMs });
  }
  if (!response.ok) throw new ScrapeError('store_rejected', `GET ${path} returned ${status}`, { status });

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  if (!contentType.includes('application/json')) {
    throw new ScrapeError('malformed_response', `GET ${path} returned ${contentType || 'no content type'}: ${raw.slice(0, 80)}`);
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ScrapeError('malformed_response', `GET ${path} returned invalid JSON: ${raw.slice(0, 80)}`);
  }
  if (!isValid(body)) throw new ScrapeError('malformed_response', `GET ${path} returned an unexpected shape`);
  return body;
}

const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';

function isItem(body) {
  return Number.isInteger(body?.id)
    && isNonEmptyString(body.name)
    && isNonEmptyString(body.optionAxis)
    && Array.isArray(body.options) && body.options.length > 0
    && body.options.every(o => /^o\d+$/.test(o?.id) && isNonEmptyString(o.label));
}

function isListingPage(body) {
  return ['page', 'perPage', 'totalPages', 'count'].every(key => Number.isInteger(body?.[key]))
    && Array.isArray(body.results)
    && body.results.every(p => Number.isInteger(p?.id) && isNonEmptyString(p.name));
}
