import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkDomContract, classifyChange, hashManifest, hashSchema, validateManifest } from '../src/scraper/layout.js';
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
