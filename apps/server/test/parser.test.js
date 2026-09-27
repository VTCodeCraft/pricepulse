import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractOffer, htmlToElement, parsePrice, parseStock } from '../src/scraper/parser.js';

const OFFERS = join(import.meta.dirname, 'fixtures', 'offers');
const load = name => ({
  meta: JSON.parse(readFileSync(join(OFFERS, `${name}.json`), 'utf8')),
  html: readFileSync(join(OFFERS, `${name}.html`), 'utf8'),
});
const NBSP = String.fromCharCode(0xa0);
const ZWSP = String.fromCharCode(0x200b);
const errorCode = fn => {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return 'no error';
};

describe('parsePrice', () => {
  it.each([
    ['₹36,312', 36312],
    ['₹2,11,444', 211444],
    ['₹90,313/- (incl. of all taxes)', 90313],
    [`Rs.${NBSP}1,393.00`, 1393],
    ['₹５４,５７７', 54577],
    ['₹1 432', 1432],
    ['₹36.312,00', 36312],
    ['₹2.11.444,00', 211444],
    [[...'₹1,432'].join(NBSP + ZWSP), 1432],
    [[...'₹36.312,00'].join(ZWSP), 36312],
  ])('%j → %d INR', (text, price) => {
    expect(parsePrice(text)).toEqual({ price, currency: 'INR' });
  });

  it.each(['1,432', '$1,432', 'Rs 1,393', '₹', '₹1,2,3', '₹12,34,5', 'Member price ₹1,52,672', '₹1,432 ₹999', '₹-5', '₹0'])(
    'rejects %j instead of guessing',
    text => expect(errorCode(() => parsePrice(text))).toMatch(/^(parse_error|invalid_value)$/),
  );
});

describe('parseStock', () => {
  it.each([
    ['Available (112)', 112],
    ['Last few: 141', 141],
    ['Ready to ship · 74 available', 74],
    ['Stock: 193 remaining', 193],
    ['30 units available', 30],
    ['Sold out', 0],
    ['AVAILABLE (142)', 142],
  ])('%j → %d', (text, stock) => expect(parseStock(text)).toBe(stock));

  it.each(['In stock', '5 left', '', 'Available (lots)'])('rejects %j', text => {
    expect(errorCode(() => parseStock(text))).toBe('parse_error');
  });
});

describe('extractOffer on real fixtures', () => {
  const ready = ['ready-default-clean', 'ready-trailing-tax-suffix', 'ready-rs-decimal-sold-out', 'ready-member-price-decoy', 'ready-unicode-digits'];

  it.each(ready)('%s: reads the real price and stock, never a decoy', name => {
    const { meta, html } = load(name);
    const offer = extractOffer(htmlToElement(html), meta.manifest);
    expect(offer).toMatchObject({ price: meta.expected.price, stock: meta.expected.stock, currency: 'INR' });
    for (const decoy of [...offer.decoys.hiddenPriceValue, ...offer.decoys.hiddenAmount, ...offer.decoys.mrp]) {
      expect(parsePrice(decoy).price).not.toBe(offer.price);
    }
  });

  it('never takes the member price', () => {
    const { meta, html } = load('ready-member-price-decoy');
    const offer = extractOffer(htmlToElement(html), meta.manifest);
    expect(offer.decoys.memberPrice).toEqual(['Member price ₹1,52,672']);
    expect(offer.price).toBe(90313);
  });

  it('turns "Sold out" into stock 0', () => {
    const { meta, html } = load('ready-rs-decimal-sold-out');
    expect(extractOffer(htmlToElement(html), meta.manifest).stock).toBe(0);
  });

  it('reports how many attempts the store page itself needed', () => {
    const { meta, html } = load('ready-trailing-tax-suffix');
    expect(extractOffer(htmlToElement(html), meta.manifest).storeAttempts).toBe(2);
  });

  it('refuses a pending ("Refreshing prices") value', () => {
    const { meta, html } = load('pending-refreshing');
    expect(errorCode(() => extractOffer(htmlToElement(html), meta.manifest))).toBe('pending_price');
  });

  it.each([
    ['state-failed-network', 'store_gave_up'],
    ['state-failed-injected', 'store_gave_up'],
    ['state-locked', 'not_ready'],
    ['state-retrying-injected', 'not_ready'],
  ])('%s → %s', (name, code) => {
    const { meta, html } = load(name);
    expect(errorCode(() => extractOffer(htmlToElement(html), meta.manifest))).toBe(code);
  });

  it('fails when the manifest names a class that is not on the page', () => {
    const { meta, html } = load('ready-default-clean');
    const manifest = { ...meta.manifest, classes: { ...meta.manifest.classes, priceValue: 'zzz-q9' } };
    expect(errorCode(() => extractOffer(htmlToElement(html), manifest))).toBe('selector_missing');
  });

  it('fails when two elements claim to be the price', () => {
    const { meta, html } = load('ready-default-clean');
    const priceTag = html.match(new RegExp(`<span class="[^"]*${meta.manifest.classes.priceValue}[^>]*>[^<]*</span>`))[0];
    expect(errorCode(() => extractOffer(htmlToElement(html.replace(priceTag, priceTag + priceTag)), meta.manifest))).toBe('selector_ambiguous');
  });

  it('reads the "split" carrier (one span per character, zero-width spaces between), seen live in revision 633004', () => {
    const { meta, html } = load('ready-default-clean');
    const manifest = { ...meta.manifest, priceTag: 'strong', priceCarrier: 'split' };
    const priceElement = html.match(new RegExp(`<span class="[^"]*${meta.manifest.classes.priceValue}[^>]*>[^<]*</span>`))[0];
    const split = [...'₹36,312'].map((ch, i, all) => `<span>${ch}${i < all.length - 1 ? ZWSP : ''}</span>`).join('');
    const splitElement = `<strong class="v1a2b3c ${meta.manifest.classes.priceValue}" style="opacity: 1;">${split}</strong>`;
    expect(extractOffer(htmlToElement(html.replace(priceElement, splitElement)), manifest).price).toBe(36312);
  });

  it('fails on an unusable manifest instead of guessing a selector', () => {
    const { meta, html } = load('ready-default-clean');
    const manifest = { ...meta.manifest, priceCarrier: 'svg' };
    expect(errorCode(() => extractOffer(htmlToElement(html), manifest))).toBe('layout_changed');
  });
});
