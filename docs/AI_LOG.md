# AI usage record

## Tools

AI-assisted tools used during development included **Claude**, **OpenCode**, **Google Antigravity**, **Kiro** and
**GitHub Copilot**. They supported:

- exploration of the store and the codebase
- debugging
- implementation
- test writing
- documentation
- iteration

I set the scope and design direction and did all account and infrastructure setup (GitHub, Render, Supabase,
cron-job.org, Vercel). Every change was reviewed, tested and verified by me before it was committed.

## Mistakes and corrections

AI output was treated as a draft to be verified. Below are the concrete errors that review, tests or production
checks caught, and how each was corrected.

### 1. Stale React state taken as ground truth (store inspection)
- **Mistake:** a capture probe read the decoded quote from React internals and picked a stale copy of the component.
- **Found:** the first check per product recorded `phase: "loading"` while the panel was already `offer-ready`.
- **Fix:** ground truth is the DOM after explicit waits plus the quote network response. No fixture or test uses
  React-internal data.

### 2. Secret guard broken by an edit (fixture export)
- **Mistake:** a `sed` edit to the fixture export's secret guard stripped the regex backslashes, so it no longer
  matched `Bearer <token>`.
- **Found:** re-reading the guard after the edit.
- **Fix:** rewrote it as `/bearer\s|authorization|set-cookie|"pass"\s*:|R0VUfC/i`. The same scan now runs in
  `apps/server/test/fixtures.test.js`.

### 3. Invisible characters in source (parser)
- **Mistake:** literal U+00A0 and U+200B characters were written into a test and a price regex.
- **Found:** a test failed on the valid `Rs. 1,393.00` fixture; `od -c` and a code-point scan showed the raw bytes.
- **Fix:** named constants (`String.fromCharCode(0xa0)`, `ZERO_WIDTH_SPACE`) and `\s`. The parser works on text
  content, not serialized HTML.

### 4. Structure check rejected a normal loading state (scraper)
- **Mistake:** `checkDomContract` required a price button in every panel state.
- **Found:** the test on the captured `state-retrying-injected` fixture failed. While the store retries, the panel
  shows a spinner and no button.
- **Fix:** the button is required only in the locked, ready and failed states.

### 5. A failed run could leave an attempt unfinished forever (runner)
- **Mistake:** a failed run was closed, but its in-progress attempt was left with no outcome. The stale-run reaper
  only looks at runs still `running`.
- **Found:** reviewing the runner's error path against the reaper query.
- **Fix:** `failUnfinishedAttempts(runIds)` is shared by the reaper and the runner's failure path.

### 6. Search could never load the catalogue (API)
- **Mistake:** `products.catalog_synced_at` defaulted to `now()`, and search treated any product row as "catalogue
  loaded". Tracking inserts product rows, so the sync never started.
- **Found:** a smoke test returned `catalog.count: 3` (the tracked products) and no search results.
- **Fix:** migration `002_catalog_synced_at_nullable.sql`. Only products seen by a full sync count.

### 7. SQL parameter typed as integer (API)
- **Mistake:** `coalesce($5, 5)` let PostgreSQL infer `$5` as an integer.
- **Found:** `POST /api/tracked` with `priceDropThresholdPct: 7.5` returned 500.
- **Fix:** `coalesce($5::numeric, 5)`. The API test uses a fractional threshold.

### 8. Cron failures diagnosed by guessing (scheduling)
- **Mistake:** proposed several causes for failing cron calls (time zone, unreachable app, bot challenge) before
  checking what the client received.
- **Found:** reproducing with different `Accept` headers against a sleeping instance. Render serves a 258 KB HTML
  loading page to requests that accept `text/html`; curl's `*/*` never met it.
- **Fix:** both cron jobs send `Accept: application/json`, and a wake-up job runs before each scrape call.

### 9. A dead run blocked every later trigger (API, found in production)
- **Mistake:** triggers answered 409 whenever a run was `running`, but stale-run cleanup ran only after that check.
- **Found:** a run stayed `running` after its instance crashed (entry 10). A regression test with a
  20-minute-old heartbeat reproduced the 409.
- **Fix:** stale runs are closed before the lock is checked. Tests cover the cron call and a manual scrape.

### 10. The consent handler could crash the process (scraper, found in production)
- **Mistake:** the `page.addLocatorHandler` callback could reject. Playwright calls it from an event listener, so
  Node exited on the unhandled rejection.
- **Found:** Render logs showed `triggerUncaughtException` and "Exited with status 1"; reproduced locally by
  closing the context mid-click.
- **Fix:** the consent handler and fault-injection handlers catch their own errors. The scrape still fails and is
  classified. Tests cover a closed page.

### 11. A dashboard figure from unreliable counters (frontend)
- **Mistake:** the dashboard figures summed run counters, which a crashed run never writes.
- **Found:** cross-checking against the database: 39 successes and 0 failures shown, 41 and 1 actual.
- **Fix:** the figures count outcomes from the attempt log, the same source as history and CSV.

### 12. Cached data hidden behind an error (frontend)
- **Mistake:** a component checked `isError` before its data. After a failed background refresh React Query keeps
  the data and still reports the error.
- **Found:** with the API stopped, a refetch failed and the card showed an error while the rest of the page used
  the same cached data.
- **Fix:** the product page shows an error only when there is no data.
- **Still open:** the tracked-products table and the dashboard's key-figures strip still show the error.

### 13. A config that only type-checked on one machine (frontend)
- **Mistake:** `vite.config.ts` used `node:fs` and `process.env`. Node's types resolved only through a stray
  `@types/node` in a parent folder.
- **Found:** CI failed with "Cannot find name 'process'"; a clean clone reproduced it.
- **Fix:** import `package.json` directly and read the commit from `VITE_VERCEL_GIT_COMMIT_SHA`.

### 14. A CI failure fixed by guessing (CI/CD)
- **Mistake:** a new actionlint job was pushed without running it locally. The first fix for its failure was a
  guess, and the annotation template then had a syntax error.
- **Found:** making the job report findings and fatal errors as annotations. The real finding was shellcheck SC2016
  on the step's own template.
- **Fix:** findings are always reported as annotations; SC2016 is disabled on that one line with a reason.

### 15. A time-dependent test assertion (scheduler)
- **Mistake:** a runner test asserted that a second tick finds nothing due, ignoring the 5-minute scheduler
  tolerance. It would fail near every hour.
- **Found:** reviewing `isDue` before committing.
- **Fix:** removed the assertion. Repeated ticks are covered by the "overdue option runs once" test.

### 16. A deploy path switched on before it was proven (CI/CD)
- **Mistake:** moved frontend deploys to the Vercel CLI in GitHub Actions and turned off Vercel's own Git deploys in
  the same step, before the CLI path had worked once.
- **Found:** Deploy runs #8 to #13 failed at `vercel pull` ("Could not retrieve Project Settings"); credential checks
  added to the workflow narrowed it to the IDs and then the token's access. No frontend deploys happened meanwhile.
  The live site stayed up on its last deployment.
- **Fix:** returned the frontend to Vercel's Git integration and kept the Render deploy hook, which worked from its
  first run.
