import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkDomContract, classifyChange, hashManifest, hashSchema, pageStructure, validateManifest } from '../src/scraper/layout.js';
import { htmlToElement } from '../src/scraper/parser.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const readJson = path => JSON.parse(readFileSync(join(FIXTURES, path), 'utf8'));
const older = readJson('store-api/manifest-633001.json');
const newer = readJson('store-api/manifest-633003.json');

describe('validateManifest', () => {
  it('accepts both real revisions', () => {
    expect(validateManifest(older)).toEqual({ valid: true, problems: [] });
    expect(validateManifest(newer)).toEqual({ valid: true, problems: [] });
  });

  it.each([
    ['a missing class key', { ...newer, classes: { ...newer.classes, stock: undefined } }, 'classes.stock'],
    ['a class name that is not a plain identifier', { ...newer, classes: { ...newer.classes, priceValue: 'a b' } }, 'classes.priceValue'],
    ['an unknown price carrier', { ...newer, priceCarrier: 'canvas' }, 'priceCarrier'],
    ['a broken fact order', { ...newer, order: ['stock', 'stock', 'seller', 'rating'] }, 'order'],
    ['a non-integer revision', { ...newer, revision: '633003' }, 'revision'],
  ])('rejects %s', (_label, manifest, field) => {
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.problems.join()).toContain(field);
  });
});

describe('fingerprints', () => {
  it('a rotation changes the manifest hash but not the schema hash', () => {
    expect(hashManifest(older)).not.toBe(hashManifest(newer));
    expect(hashSchema(older)).toBe(hashSchema(newer));
  });

  it('validUntil alone does not change the manifest hash', () => {
    expect(hashManifest({ ...newer, validUntil: newer.validUntil + 60_000 })).toBe(hashManifest(newer));
  });

  it('a new key changes the schema hash', () => {
    expect(hashSchema({ ...newer, priceFont: 'serif' })).not.toBe(hashSchema(newer));
  });
});

describe('classifyChange', () => {
  const describeLayout = manifest => ({ manifestHash: hashManifest(manifest), schemaHash: hashSchema(manifest), valid: validateManifest(manifest).valid });

  it.each([
    ['first_seen', undefined, describeLayout(newer)],
    ['same', describeLayout(newer), describeLayout(newer)],
    ['rotation', describeLayout(older), describeLayout(newer)],
    ['schema_changed', describeLayout(newer), describeLayout({ ...newer, priceFont: 'serif' })],
    ['incompatible', describeLayout(newer), describeLayout({ ...newer, priceCarrier: 'canvas' })],
    ['incompatible', describeLayout(newer), { ...describeLayout(newer), domOk: false }],
  ])('%s', (expected, previous, current) => {
    expect(classifyChange(previous, current)).toBe(expected);
  });
});

describe('checkDomContract', () => {
  // Same markup the store renders around the price panel (see docs/store-notes.md, section 5).
  const chips = '<div class="opt-picker" role="group" aria-label="Storage"><button class="opt-chip opt-chip-on" aria-pressed="true">64 GB</button></div>';
  const summary = panelFixture => htmlToElement(`<div class="pdp-summary">${chips}${readFileSync(join(FIXTURES, 'offers', `${panelFixture}.html`), 'utf8')}</div>`);

  it.each(['state-locked', 'ready-default-clean', 'state-retrying-injected', 'state-failed-network'])('passes for %s', name => {
    expect(checkDomContract(summary(name))).toEqual({ ok: true, missing: [] });
  });

  it('reports missing option chips and a missing panel', () => {
    expect(checkDomContract(htmlToElement('<div class="pdp-summary"><p>new design</p></div>'))).toEqual({
      ok: false,
      missing: ['.offer-panel', 'option chips'],
    });
  });
});

describe('pageStructure', () => {
  const panelHtml = name => readFileSync(join(FIXTURES, 'offers', `${name}.html`), 'utf8');
  const structure = (html, manifest = newer) => pageStructure(htmlToElement(html), manifest);
  const baseline = structure(panelHtml('ready-default-clean'));

  it('describes where the price, stock and price button sit, without rotating names', () => {
    expect(baseline.signature).toEqual({
      panel: { tag: 'div', live: 'polite' },
      price: ['div.offer-row', 'priceValue'],
      stock: ['div.offer-facts', 'stock'],
      button: ['div.offer-foot', 'button.ctl.ctl-plain.ctl-xs'],
    });
    expect(structure(panelHtml('ready-default-clean')).hash).toBe(baseline.hash);
    // Same hash the live store gave on 2026-09-27 (revision 634003) for products 2179 and 2852.
    expect(baseline.hash).toBe('f2df7c36df0c6119');
  });

  it.each(['ready-member-price-decoy', 'ready-rs-decimal-sold-out', 'ready-trailing-tax-suffix', 'ready-unicode-digits'])(
    'other products, prices, formats, stock and decoys do not change it (%s)',
    name => expect(structure(panelHtml(name)).hash).toBe(baseline.hash),
  );

  it('a class rotation with a new price tag and fact order does not change it', () => {
    // The same panel rendered under revision 633001: every manifest class renamed, <data> for the price, facts reordered.
    let html = panelHtml('ready-default-clean');
    for (const [key, name] of Object.entries(newer.classes)) html = html.replaceAll(name, older.classes[key]);
    html = html.replace(/<span class="(\w+) fgy-x1"([^>]*)>([^<]*)<\/span>/, '<data class="zz81kq fgy-x1"$2>$3</data>');
    const facts = html.match(/<div class="offer-facts">(.*)<\/div><div class="offer-foot">/)[1];
    const [rating, delivery, seller, stock] = facts.match(/<div class="[\w-]+"[^>]*>.*?<\/div>(?=<div class="[\w-]+"|$)/g);
    html = html.replace(facts, stock + seller + delivery + rating);
    expect(html).toContain('<data class="zz81kq fgy-x1"');
    expect(structure(html, older).hash).toBe(baseline.hash);
  });

  it('moving the price or the stock, or losing the button, changes it', () => {
    const html = panelHtml('ready-default-clean');
    const wrappedPrice = html.replace(/(<span class="vlo9guy kjr-w7"[^>]*>[^<]*<\/span>)/, '<div class="price-box">$1</div>');
    expect(structure(wrappedPrice)).toMatchObject({ signature: { price: ['div.offer-row', 'div.price-box', 'priceValue'] } });
    expect(structure(wrappedPrice).hash).not.toBe(baseline.hash);

    const stockInRow = html.replace(/(<div class="rtz-w7">.*?<\/span><\/div>)/, '').replace('<div class="offer-row">', '<div class="offer-row"><div class="rtz-w7"><span class="avail-pill avail-yes">In stock</span></div>');
    expect(structure(stockInRow).signature.stock).toEqual(['div.offer-row', 'stock']);

    expect(structure(html.replace(/<button[^>]*>.*?<\/button>/, '')).signature.button).toBeNull();
  });
});
