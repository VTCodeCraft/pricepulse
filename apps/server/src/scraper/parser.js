// Pure parsing of the store's rendered price panel. No browser and no network, so fixtures can test it directly.
import { parseHTML } from 'linkedom';
import { offerSelectors } from './layout.js';
import { ScrapeError } from './retry.js';

const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const MAX_PRICE = 10_000_000;

// The scraper copies an element's outerHTML out of the page and turns it back into a DOM element here.
export function htmlToElement(html) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return document.body.firstElementChild;
}

export function parsePrice(text) {
  // NFKC turns full-width digits into ASCII; \s also covers the no-break space in the "Rs." format.
  const compact = text.normalize('NFKC').replaceAll(ZERO_WIDTH_SPACE, '').replace(/\s+/g, '');
  const match = compact.match(/^(?:₹|Rs\.)([\d.,]+?)(?:\/-\(incl\.ofalltaxes\))?$/);
  if (!match) throw new ScrapeError('parse_error', `unrecognised price "${text}"`);

  let amount = match[1];
  // Euro-style rendering of an Indian number: 36.312,00 or 2.11.444,00.
  if (/^\d{1,3}(?:\.\d{2,3})+,\d{2}$/.test(amount)) amount = amount.replaceAll('.', ',').replace(/,(\d{2})$/, '.$1');
  // Plain digits, or Indian grouping (1,432 · 90,313 · 2,11,444), with optional paise.
  const number = amount.match(/^(\d+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.(\d{2}))?$/);
  if (!number) throw new ScrapeError('parse_error', `unrecognised price "${text}"`);

  const price = Number(number[1].replaceAll(',', '')) + Number(number[2] ?? 0) / 100;
  if (!(price > 0 && price <= MAX_PRICE)) throw new ScrapeError('invalid_value', `implausible price ${price} from "${text}"`);
  return { price, currency: 'INR' };
}

const STOCK_PATTERNS = [
  /^(\d+) units available$/i,
  /^Last few: (\d+)$/i,
  /^Available \((\d+)\)$/i,
  /^Stock: (\d+) remaining$/i,
  /^Ready to ship · (\d+) available$/i,
];

export function parseStock(text) {
  const clean = text.normalize('NFKC').replaceAll(ZERO_WIDTH_SPACE, '').replace(/\s+/g, ' ').trim();
  if (/^sold out$/i.test(clean)) return 0;
  for (const pattern of STOCK_PATTERNS) {
    const match = clean.match(pattern);
    if (match) return Number(match[1]);
  }
  throw new ScrapeError('parse_error', `unrecognised stock "${text}"`);
}

// Reads price and stock from a ready `.offer-panel`, using the class names from the manifest the page loaded.
export function extractOffer(panel, manifest) {
  if (!panel?.classList.contains('offer-panel')) throw new ScrapeError('selector_missing', 'price panel (.offer-panel) not found');
  if (panel.classList.contains('offer-failed')) {
    throw new ScrapeError('store_gave_up', `store page gave up: ${text(panel.querySelector('.offer-submsg')) || text(panel)}`);
  }
  if (!panel.classList.contains('offer-ready')) throw new ScrapeError('not_ready', 'price panel is not showing a price yet');

  const selectors = offerSelectors(manifest);
  const priceElement = exactlyOne(panel, selectors.price, 'price');
  const stockElement = exactlyOne(panel, selectors.stock, 'stock');
  const displayed = { price: text(priceElement), stock: text(stockElement) };

  // "Refreshing prices" dims a transitional number that differs from the settled price. Never accept it.
  if (panel.textContent.includes('Refreshing prices') || opacity(priceElement) < 1) {
    throw new ScrapeError('pending_price', `price is still refreshing (showing "${displayed.price}")`, { displayed });
  }
  if (isHidden(priceElement)) throw new ScrapeError('selector_ambiguous', `price element ${selectors.price} is hidden`);

  const { price, currency } = parsePrice(displayed.price);
  const stock = parseStock(displayed.stock);
  const storeAttempts = Number(text(panel.querySelector('.offer-foot span')).match(/Loaded in (\d+) attempt/)?.[1] ?? 1);

  return {
    price,
    currency,
    stock,
    displayed,
    storeAttempts,
    decoys: {
      hiddenPriceValue: texts(panel, '.price-value'),
      hiddenAmount: texts(panel, '.amount[data-price]'),
      mrp: texts(panel, selectors.mrp),
      memberPrice: texts(panel, selectors.memberPrice),
    },
  };
}

function exactlyOne(root, selector, what) {
  const found = root.querySelectorAll(selector);
  if (found.length === 0) throw new ScrapeError('selector_missing', `no ${what} element matches ${selector}`);
  if (found.length > 1) throw new ScrapeError('selector_ambiguous', `${found.length} ${what} elements match ${selector}`);
  return found[0];
}

const text = element => element?.textContent ?? '';
const texts = (root, selector) => [...root.querySelectorAll(selector)].map(text);
const styleValue = (element, property) => element.getAttribute('style')?.match(new RegExp(`${property}:\\s*([^;]+)`))?.[1]?.trim();
const opacity = element => Number(styleValue(element, 'opacity') ?? 1);
const isHidden = element => styleValue(element, 'display') === 'none' || element.getAttribute('aria-hidden') === 'true';
