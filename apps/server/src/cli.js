// Scrape one product option from the terminal, headless or headed. No database needed.
//   pnpm scrape -- --product 2179 --option o1
//   pnpm scrape -- --product 2179 --option o1 --headed --slow-mo 250
//   ALLOW_FAULT_INJECTION=true pnpm scrape -- --product 2179 --option o1 --inject quote:503x6
import { parseArgs } from 'node:util';
import { config } from './config.js';
import { assertFaultInjectionAllowed, parseFaultPlan } from './faults.js';
import { scrapeWithRetry } from './scraper.js';

const argv = process.argv.slice(2);
if (argv[0] === '--') argv.shift(); // pnpm forwards the "--" separator
const { values } = parseArgs({
  args: argv,
  options: {
    product: { type: 'string' },
    option: { type: 'string' },
    headed: { type: 'boolean', default: false },
    'slow-mo': { type: 'string', default: '0' },
    inject: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

const productId = Number(values.product);
if (!Number.isInteger(productId) || productId <= 0 || !/^o\d+$/.test(values.option ?? '')) {
  console.error('usage: pnpm scrape -- --product <id> --option <o1|o2|…> [--headed] [--slow-mo ms] [--inject plan] [--json]');
  process.exit(2);
}

let faultPlan;
if (values.inject) {
  try {
    assertFaultInjectionAllowed();
    faultPlan = parseFaultPlan(values.inject);
  } catch (error) {
    console.error(`--inject refused: ${error.message}`);
    process.exit(2);
  }
  console.log(`FAULT INJECTION ON (our browser only, the store is not touched): ${values.inject}`);
}

const started = Date.now();
const log = message => console.log(`[${((Date.now() - started) / 1000).toFixed(1).padStart(5)} s] ${message}`);
log(`product ${productId}, option ${values.option}, ${values.headed ? 'headed' : 'headless'}, up to ${config.maxTries} tries`);

const run = await scrapeWithRetry(
  { productId, optionId: values.option },
  { headed: values.headed, slowMo: Number(values['slow-mo']), faultPlan, log },
);

if (run.result) {
  const r = run.result;
  log(`${r.productName} — ${r.optionLabel}: ${r.currency} ${r.price} · stock ${r.stock} (shown as "${r.displayed.price}" / "${r.displayed.stock}")`);
}
for (const t of run.tries.filter(t => !t.ok)) log(`try ${t.tryNumber} failed: ${t.code} — ${t.message}`);
log(`outcome: ${run.outcome.toUpperCase()} after ${run.tries.length} ${run.tries.length === 1 ? 'try' : 'tries'}`);
if (values.json) console.log(JSON.stringify(run, null, 2));
process.exitCode = run.outcome === 'failed' ? 1 : 0;
