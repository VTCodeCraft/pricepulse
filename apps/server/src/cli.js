// Command-line entry points. Single scrapes need no database; --track and --all use DATABASE_URL.
//   pnpm scrape -- --product 2179 --option o1 [--headed] [--slow-mo 250] [--json]
//   pnpm scrape -- --track --product 2179 --option o1 [--interval 120]
//   pnpm scrape -- --all                       (every active tracked option, through the runner)
//   ALLOW_FAULT_INJECTION=true pnpm scrape -- --product 2179 --option o1 --inject quote:503x6
import { parseArgs } from 'node:util';
import { config } from './config.js';
import { closeDb } from './db.js';
import { assertFaultInjectionAllowed, parseFaultPlan } from './faults.js';
import { runTick, trackOption } from './runner.js';
import { scrapeWithRetry } from './scraper.js';

const argv = process.argv.slice(2);
if (argv[0] === '--') argv.shift(); // pnpm forwards the "--" separator
const { values } = parseArgs({
  args: argv,
  options: {
    product: { type: 'string' },
    option: { type: 'string' },
    all: { type: 'boolean', default: false },
    track: { type: 'boolean', default: false },
    interval: { type: 'string', default: '120' },
    headed: { type: 'boolean', default: false },
    'slow-mo': { type: 'string', default: '0' },
    inject: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

const started = Date.now();
const log = message => console.log(`[${((Date.now() - started) / 1000).toFixed(1).padStart(5)} s] ${message}`);

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

const productId = Number(values.product);
if (!values.all && (!Number.isInteger(productId) || productId <= 0 || !/^o\d+$/.test(values.option ?? ''))) {
  console.error('usage: pnpm scrape -- --product <id> --option <oN> [--headed] [--slow-mo ms] [--inject plan] [--json]');
  console.error('       pnpm scrape -- --track --product <id> --option <oN> [--interval minutes]');
  console.error('       pnpm scrape -- --all');
  process.exit(2);
}

try {
  if (values.all) {
    const run = await runTick({ trigger: 'cli', force: true, faultPlan, log });
    log(`run ${run.runId ?? '-'}: ${run.status}${run.error ? ` (${run.error})` : ''} · success ${run.success ?? 0}, retried ${run.retried ?? 0}, failed ${run.failed ?? 0}`);
    process.exitCode = run.status === 'completed' ? 0 : 1;
  } else if (values.track) {
    const tracked = await trackOption(productId, values.option, { intervalMinutes: Number(values.interval) });
    log(`tracking #${tracked.id}: product ${productId} option ${tracked.option_id} (${tracked.option_label}), every ${tracked.scrape_interval_minutes} min`);
  } else {
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
  }
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDb(); // no-op when the database was not used
}
