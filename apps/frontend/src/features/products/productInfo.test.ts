import { describe, expect, it } from 'vitest';
import type { Product, TrackedProduct } from '../../types/product';
import { productInfo, specRows, trackAction, trackedOptionsOf } from './productInfo';

const live: Product = {
  storeProductId: 2331,
  productUrl: 'https://demo.inelabteamdev.com/item/2331',
  name: 'Halvard Drawing Tablet Prime',
  brand: 'Halvard',
  optionAxis: 'Storage',
  options: [{ id: 'o1', label: '64 GB' }],
  reviewSummary: null,
};

const stored = {
  storeProductId: 2331,
  optionId: 'o3',
  productName: 'Halvard Drawing Tablet Prime (stored)',
  productUrl: 'https://demo.inelabteamdev.com/item/2331',
  brand: 'Halvard',
  category: 'Tablets',
  sku: 'SK-2331-HA',
  description: null,
  optionAxis: 'Storage',
  options: [{ id: 'o3', label: '256 GB' }],
  specs: null,
  reviewSummary: { count: 7, avgRating: 4 },
} as TrackedProduct;

describe('productInfo', () => {
  it('prefers the live store details and keeps missing fields as null', () => {
    expect(productInfo(live, stored)).toMatchObject({ name: 'Halvard Drawing Tablet Prime', category: null, sku: null, specs: null });
  });

  it('falls back to the stored copy when the store could not be reached', () => {
    expect(productInfo(undefined, stored)).toMatchObject({
      name: 'Halvard Drawing Tablet Prime (stored)',
      category: 'Tablets',
      options: [{ id: 'o3', label: '256 GB' }],
    });
  });

  it('is null when neither is available', () => {
    expect(productInfo(undefined, undefined)).toBeNull();
  });
});

describe('trackedOptionsOf', () => {
  it('finds the tracked options of one product only', () => {
    const other = { ...stored, storeProductId: 2852, optionId: 'o1' };
    const second = { ...stored, optionId: 'o1' };
    expect([...trackedOptionsOf([stored, other, second], 2331).keys()]).toEqual(['o3', 'o1']);
  });
});

describe('specRows', () => {
  it('labels spec keys and formats weights', () => {
    expect(specRows({ inTheBox: 'Tablet, Stylus', modelYear: 2025, weightGrams: 796, colour: 'Bone White' })).toEqual([
      { label: 'In the box', value: 'Tablet, Stylus' },
      { label: 'Model year', value: '2025' },
      { label: 'Weight', value: '796 g' },
      { label: 'Colour', value: 'Bone White' },
    ]);
    expect(specRows({ weightGrams: 4869 })[0].value).toBe('4.87 kg');
  });
});

describe('trackAction', () => {
  it('keeps tracking open while an option is still free, since tracking is per option', () => {
    expect(trackAction(0, null)).toEqual({ label: 'Track Product', disabled: false });
    expect(trackAction(1, 3)).toEqual({ label: 'Track another option', disabled: false });
    expect(trackAction(1, null)).toEqual({ label: 'Track another option', disabled: false }); // option count not known yet
    expect(trackAction(3, 3)).toEqual({ label: 'Tracked', disabled: true });
  });
});
