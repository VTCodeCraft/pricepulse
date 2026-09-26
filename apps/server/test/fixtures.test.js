// Integrity checks for the store fixtures captured in Phase 1 (docs/store-notes.md, section 11).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OFFERS = join(import.meta.dirname, 'fixtures', 'offers');
const API = join(import.meta.dirname, 'fixtures', 'store-api');

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const offers = readdirSync(OFFERS)
  .filter(file => file.endsWith('.json'))
  .map(file => ({
    meta: readJson(join(OFFERS, file)),
    html: readFileSync(join(OFFERS, file.replace(/\.json$/, '.html')), 'utf8'),
  }));
const offer = name => offers.find(o => o.meta.fixture === name);

// Opening tags whose class list contains `name` (class names come from the manifest).
const tagsWithClass = (html, name) => html.match(new RegExp(`<[^>]*class="[^"]*\\b${name}\\b[^"]*"[^>]*>`, 'g')) ?? [];
// outerHTML writes the U+00A0 used by the "Rs." format as &nbsp;.
const decode = html => html.replaceAll('&nbsp;', String.fromCharCode(0xa0));

function expectManifestShape(m) {
  expect(Number.isInteger(m.revision)).toBe(true);
  expect(Number.isInteger(m.variant)).toBe(true);
  for (const key of ['priceWrap', 'priceValue', 'mrp', 'sale', 'badge', 'rating', 'seller', 'delivery', 'stock']) {
    expect(typeof m.classes[key], key).toBe('string');
  }
  expect([...m.order].sort()).toEqual(['delivery', 'rating', 'seller', 'stock']);
  expect(typeof m.priceTag).toBe('string');
  expect(['text', 'split']).toContain(m.priceCarrier);
}

describe.each(offers.map(o => [o.meta.fixture, o]))('%s', (_name, { meta, html }) => {
  it('records product, option, manifest and expected result', () => {
    expect(meta.storeProductId).toBeGreaterThanOrEqual(2001);
    expect(meta.storeProductId).toBeLessThanOrEqual(2960);
    expect(meta.option.id).toMatch(/^o\d+$/);
    expect(meta.option.label).toBeTruthy();
    expectManifestShape(meta.manifest);
    // The panel carries the manifest's wrapper class, so this HTML was rendered with this manifest.
    expect(tagsWithClass(html, meta.manifest.classes.priceWrap)).toHaveLength(1);
    expect(typeof meta.expected.storable).toBe('boolean');
  });

  if (meta.state === 'ready') {
    it('has exactly one real price and stock element, distinct from the decoys', () => {
      expect(tagsWithClass(html, meta.manifest.classes.priceValue)).toHaveLength(1);
      expect(tagsWithClass(html, meta.manifest.classes.stock)).toHaveLength(1);
      expect(decode(html)).toContain(meta.displayed.price);
      expect(decode(html)).toContain(meta.displayed.stock);
      expect(html).toContain('class="price-value"');
      expect(html).toContain('data-price="true"');
      for (const decoy of [meta.decoys.hiddenPriceValue, meta.decoys.hiddenAmount, meta.decoys.mrp]) {
        expect(decoy).not.toBe(meta.displayed.price);
      }
    });

    it('ends with a quote response for the exact product and option', () => {
      const last = meta.quoteResponses.at(-1);
      expect(last.status).toBe(200);
      expect(last.path).toBe(`/api/v2/items/${meta.storeProductId}/quote?opt=${meta.option.id}`);
      expect(last.body).toEqual({ itemId: meta.storeProductId, option: meta.option.id });
    });
  }
});

describe('store behaviours the scraper must handle', () => {
  it('covers every price format and stock case seen live', () => {
    const prices = offers.filter(o => o.meta.state === 'ready').map(o => o.meta.displayed.price);
    expect(prices.some(p => /^₹\d{1,2}(,\d{2})*,\d{3}$/.test(p))).toBe(true);
    expect(prices.some(p => p.endsWith('/- (incl. of all taxes)'))).toBe(true);
    expect(prices.some(p => p.startsWith(`Rs.${String.fromCharCode(0xa0)}`) && p.endsWith('.00'))).toBe(true);
    expect(prices.some(p => /[０-９]/.test(p))).toBe(true);
    expect(offer('ready-rs-decimal-sold-out').meta.displayed.stock).toBe('Sold out');
    expect(offer('ready-member-price-decoy').meta.decoys.memberPrice).toMatch(/^Member price/);
  });

  it('pending price is dimmed, labelled, and not the confirmed price', () => {
    const { meta, html } = offer('pending-refreshing');
    expect(html).toContain('Refreshing prices');
    expect(tagsWithClass(html, meta.manifest.classes.priceValue)[0]).toContain('opacity: 0.45');
    expect(meta.expected.storable).toBe(false);
    expect(meta.expected.displayedPrice).not.toBe(meta.expected.confirmedPriceOnNextCheck);
  });

  it('a real 5xx recovered by the page shows up in the quote responses', () => {
    const { meta } = offer('ready-trailing-tax-suffix');
    expect(meta.quoteResponses.map(r => r.status)).toEqual([503, 200]);
    expect(meta.displayed.footer).toBe('Loaded in 2 attempts');
  });

  it('non-final states are recognisable from the panel', () => {
    expect(offer('state-locked').html).toContain('offer-locked');
    expect(offer('state-retrying-injected').html).toContain('aria-busy="true"');
    expect(offer('state-failed-network').html).toContain('offer-failed');
    expect(offer('state-failed-injected').html).toContain('offer-failed');
    expect(offer('state-failed-injected').meta.quoteResponses).toHaveLength(6);
  });
});

describe('store API fixtures', () => {
  it('two manifest revisions differ only as a rotation', () => {
    const a = readJson(join(API, 'manifest-633001.json'));
    const b = readJson(join(API, 'manifest-633003.json'));
    expectManifestShape(a);
    expectManifestShape(b);
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    expect(b.classes.priceValue).not.toBe(a.classes.priceValue);
    expect(b.priceTag).not.toBe(a.priceTag);
  });

  it('item, listing, and error bodies have the observed shapes', () => {
    expect(readJson(join(API, 'item-2331.json'))).toMatchObject({ id: 2331, optionAxis: 'Storage' });
    expect(readJson(join(API, 'item-not-found-404.json'))).toEqual({ error: 'not_found' });
    expect(readJson(join(API, 'listings-page1-limit3.json'))).toMatchObject({ page: 1, perPage: 3, count: 960 });
    expect(readJson(join(API, 'error-quote-upstream-503.json'))).toEqual({ error: 'upstream_error' });
    expect(readJson(join(API, 'error-rate-limited-429.json'))).toMatchObject({ error: 'rate_limited', retryAfter: 1 });
    expect(readFileSync(join(API, 'error-nginx-503.html'), 'utf8')).toContain('<title>503 Service Temporarily Unavailable</title>');
  });
});

it('fixtures contain no credentials, tokens, or cookie headers', () => {
  const secret = /bearer\s|authorization|set-cookie|"pass"\s*:|R0VUfC/i;
  for (const dir of [OFFERS, API]) {
    for (const file of readdirSync(dir)) {
      expect(secret.test(readFileSync(join(dir, file), 'utf8')), file).toBe(false);
    }
  }
});
