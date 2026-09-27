import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertFaultInjectionAllowed, installFaults, parseFaultPlan } from '../src/scraper/faults.js';

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

  // Playwright does not catch errors thrown by a route handler either.
  describe('route handlers', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('resolve when the page has already closed', async () => {
      vi.stubEnv('ALLOW_FAULT_INJECTION', 'true');
      const handlers = [];
      await installFaults({ route: async (_pattern, fn) => { handlers.push(fn); } }, parseFaultPlan('quote:503x1'));
      const closed = () => Promise.reject(new Error('route.fulfill: Target page, context or browser has been closed'));
      const route = { fulfill: vi.fn(closed), continue: vi.fn(closed) };
      await expect(handlers[0](route)).resolves.toBeUndefined(); // the injected 503
      await expect(handlers[0](route)).resolves.toBeUndefined(); // plan used up: passes the request on
      expect(route.fulfill).toHaveBeenCalledOnce();
      expect(route.continue).toHaveBeenCalledOnce();
    });
  });
});