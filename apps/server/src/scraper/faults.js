// Fault injection for tests and the headed demo. It intercepts requests made by OUR Playwright page only;
// the store itself is never touched. It refuses to run unless explicitly enabled outside production.
// Plan syntax: "quote:503x6,quote:delay:8000x1,handshake:500x1" (target:status|delay:ms x times).

import { sleep } from './retry.js';

const ROUTES = { quote: '**/api/v2/items/*/quote*', handshake: '**/api/v2/handshake' };

export function assertFaultInjectionAllowed(env = process.env) {
  if (env.NODE_ENV === 'production' || env.ALLOW_FAULT_INJECTION !== 'true') {
    throw new Error('fault injection needs ALLOW_FAULT_INJECTION=true and NODE_ENV other than production');
  }
}

export function parseFaultPlan(spec) {
  return spec.split(',').map(part => {
    const match = part.trim().match(/^(quote|handshake):(?:(\d{3})|delay:(\d+))x(\d+)$/);
    if (!match) throw new Error(`bad fault "${part}" (examples: quote:503x6, quote:delay:8000x1, handshake:500x1)`);
    const [, target, status, delayMs, times] = match;
    return { target, status: status ? Number(status) : null, delayMs: delayMs ? Number(delayMs) : null, remaining: Number(times) };
  });
}

// The plan's counters are shared across retries, so "quote:503x6" can exhaust the page's 6 attempts in try 1
// and let try 2 succeed. Like a locator handler, a route handler must not reject: Playwright would leave the error
// unhandled and the process would exit. The route calls fail only when the page has already closed.
export async function installFaults(page, plan) {
  assertFaultInjectionAllowed();
  for (const target of new Set(plan.map(fault => fault.target))) {
    await page.route(ROUTES[target], async route => {
      const fault = plan.find(f => f.target === target && f.remaining > 0);
      if (!fault) return route.continue().catch(() => {});
      fault.remaining--;
      if (fault.delayMs) {
        await sleep(fault.delayMs);
        return route.continue().catch(() => {});
      }
      return route.fulfill({ status: fault.status, contentType: 'application/json', body: '{"error":"injected_fault"}' }).catch(() => {});
    });
  }
}
