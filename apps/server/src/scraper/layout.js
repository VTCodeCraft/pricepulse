// The store renames its CSS classes over time and publishes the current names in /api/v2/ui/manifest.
// This module checks that manifest, fingerprints it, and checks the fixed page anchors the scraper relies on.
import { createHash } from 'node:crypto';
import { ScrapeError } from './retry.js';

const CLASS_KEYS = ['priceWrap', 'priceValue', 'mrp', 'sale', 'badge', 'rating', 'seller', 'delivery', 'stock'];
const FACT_KEYS = ['delivery', 'rating', 'seller', 'stock'];
const IDENTIFIER = /^[A-Za-z][\w-]*$/; // plain tag/class names only, so they are safe to put in a CSS selector

export function validateManifest(manifest) {
  const m = manifest ?? {};
  const problems = [];
  for (const key of ['revision', 'variant', 'validUntil']) {
    if (!Number.isInteger(m[key])) problems.push(`${key} is not an integer`);
  }
  for (const key of CLASS_KEYS) {
    if (!IDENTIFIER.test(m.classes?.[key] ?? '')) problems.push(`classes.${key} is missing or not a class name`);
  }
  if (!Array.isArray(m.order) || [...m.order].sort().join() !== FACT_KEYS.join()) problems.push('order is not the four fact keys');
  if (!IDENTIFIER.test(m.priceTag ?? '')) problems.push('priceTag is not a tag name');
  if (!['text', 'split'].includes(m.priceCarrier)) problems.push(`unknown priceCarrier "${m.priceCarrier}"`);
  for (const key of ['ratingAria', 'sellerTitle']) {
    if (typeof m[key] !== 'boolean') problems.push(`${key} is not a boolean`);
  }
  return { valid: problems.length === 0, problems };
}

export function offerSelectors(manifest) {
  const { valid, problems } = validateManifest(manifest);
  if (!valid) throw new ScrapeError('layout_changed', `store layout manifest is unusable: ${problems.join('; ')}`);
  const { priceTag, classes } = manifest;
  return {
    price: `${priceTag}.${classes.priceValue}`,
    stock: `.${classes.stock}`,
    mrp: `.${classes.mrp}`,
    memberPrice: `.${classes.sale}`,
  };
}

// Changes on every rotation. validUntil moves with time alone, so it is left out.
export function hashManifest(manifest) {
  const withoutExpiry = { ...manifest };
  delete withoutExpiry.validUntil;
  return sha256(canonicalJson(withoutExpiry));
}

// Key names and value types only: stays the same across a normal rotation, changes if the structure changes.
export function hashSchema(manifest) {
  return sha256(canonicalJson(shape(manifest)));
}

// Fixed anchors (not from the manifest) inside the product summary area: panel, its state, button, option chips.
export function checkDomContract(summary) {
  const missing = [];
  const panel = summary?.querySelector('.offer-panel');
  if (!panel) {
    missing.push('.offer-panel');
  } else {
    const settled = ['offer-locked', 'offer-ready', 'offer-failed'].some(state => panel.classList.contains(state));
    const busy = panel.getAttribute('aria-busy') === 'true';
    if (!settled && !busy) missing.push('price panel state');
    // While busy the panel shows a spinner instead of a button.
    if (settled && !panel.querySelector('button')) missing.push('price button');
  }
  if (!summary?.querySelector('[role="group"] .opt-chip[aria-pressed]')) missing.push('option chips');
  return { ok: missing.length === 0, missing };
}

// Compares the layout seen now with the previous one: { manifestHash, schemaHash, valid, domOk }.
export function classifyChange(previous, current) {
  if (!current.valid || current.domOk === false) return 'incompatible';
  if (!previous) return 'first_seen';
  if (previous.manifestHash === current.manifestHash) return 'same';
  if (previous.schemaHash === current.schemaHash) return 'rotation';
  return 'schema_changed';
}

// The structure of a ready price panel, independent of what the store rotates on purpose: where the price, the stock
// and the price button sit inside the panel, as paths of tag names and stable class names. Elements named in the
// manifest become their manifest key (the class and the price tag rotate), generated class names (with digits) are
// dropped, and nothing inside the price or stock element is read, so prices, stock text, the price format, seller
// names and fact order never change it. Moving the price or stock to a different place does.
export function pageStructure(panel, manifest) {
  const roles = new Map(Object.entries(manifest.classes ?? {}).map(([key, name]) => [name, key]));
  const token = element => {
    const role = [...element.classList].find(name => roles.has(name));
    if (role) return roles.get(role);
    const stable = [...element.classList].filter(name => !/\d/.test(name)).sort();
    return [element.tagName.toLowerCase(), ...stable].join('.');
  };
  const pathTo = selector => {
    const found = panel.querySelectorAll(selector);
    if (found.length !== 1) return null;
    const path = [];
    for (let node = found[0]; node && node !== panel; node = node.parentElement) path.unshift(token(node));
    return path;
  };
  const signature = {
    panel: { tag: panel.tagName.toLowerCase(), live: panel.getAttribute('aria-live') },
    price: pathTo(`${manifest.priceTag}.${manifest.classes?.priceValue}`),
    stock: pathTo(`.${manifest.classes?.stock}`),
    button: pathTo('button'),
  };
  return { hash: sha256(canonicalJson(signature)), signature };
}

function shape(value) {
  if (Array.isArray(value)) return ['array'];
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = text => createHash('sha256').update(text).digest('hex').slice(0, 16);
