import { describe, expect, it } from 'vitest';
import { trackFormSchema } from './trackForm';

const options = [
  { id: 'o1', label: '64 GB' },
  { id: 'o2', label: '128 GB' },
  { id: 'o3', label: '256 GB' },
];

describe('trackFormSchema', () => {
  it('produces exactly the POST /api/tracked payload', () => {
    const result = trackFormSchema(options, new Set()).safeParse({ storeProductId: 2331, optionId: 'o2' });
    expect(result.success && result.data).toEqual({ storeProductId: 2331, optionId: 'o2' });
  });

  it('requires an explicit option; nothing is chosen by default', () => {
    const result = trackFormSchema(options, new Set()).safeParse({ storeProductId: 2331, optionId: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Choose an option to track');
  });

  it('rejects an option that does not belong to the product', () => {
    const result = trackFormSchema(options, new Set()).safeParse({ storeProductId: 2331, optionId: 'o9' });
    expect(result.error?.issues[0].message).toBe('Choose one of this product’s options');
  });

  it('rejects an option that is already tracked', () => {
    const result = trackFormSchema(options, new Set(['o3'])).safeParse({ storeProductId: 2331, optionId: 'o3' });
    expect(result.error?.issues[0].message).toBe('This option is already being tracked');
  });
});
