import { describe, expect, it } from 'vitest';
import { assertFaultInjectionAllowed, parseFaultPlan } from '../src/scraper/faults.js';

describe('fault injection', () => {
  it('parses a plan', () => {
    expect(parseFaultPlan('quote:503x6, quote:delay:8000x1,handshake:500x1')).toEqual([
      { target: 'quote', status: 503, delayMs: null, remaining: 6 },
      { target: 'quote', status: null, delayMs: 8000, remaining: 1 },
      { target: 'handshake', status: 500, delayMs: null, remaining: 1 },
    ]);
  });

  it('rejects an unknown plan', () => {
    expect(() => parseFaultPlan('listing:503x1')).toThrow(/bad fault/);
  });

  it('is off unless explicitly enabled outside production', () => {
    expect(() => assertFaultInjectionAllowed({})).toThrow();
    expect(() => assertFaultInjectionAllowed({ ALLOW_FAULT_INJECTION: 'true', NODE_ENV: 'production' })).toThrow();
    expect(() => assertFaultInjectionAllowed({ ALLOW_FAULT_INJECTION: 'true' })).not.toThrow();
  });
});
