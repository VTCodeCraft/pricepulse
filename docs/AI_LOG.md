# AI usage record

## Tools and division of work

- **Claude Code** (Claude Opus 5.5, desktop app) inspected the store, wrote the code, tests and documentation in
  this repository under my direction, and ran the commands (tests, deployment checks, git).
- **I** set the scope and the order of work, reviewed each batch before approving its commits, and did all account
  and dashboard work:
  - GitHub repository
  - Render service and environment variables
  - Supabase project, CA certificate and Enforce SSL
  - cron-job.org jobs
  - Vercel project
- Commits are made under my GitHub account without AI trailers; this file is the disclosure.

Each mistake below is one Claude Code made. It was recorded when found, with the evidence and the correction.

## Mistakes and corrections

### 1. Loaded a price in a hidden browser tab (store inspection)
- **Mistake:** tried to unlock and load a price in the built-in browser pane while the pane was hidden.
- **Found:** `document.visibilityState` was `hidden`; the panel stayed "Price locked" although `mousemove` events reached it.
- **Fix:** ran the same steps in a real Playwright page. The scraper always drives its own Playwright page.

### 2. Clicked an option by screenshot coordinates (store inspection)
- **Mistake:** clicked "64 GB" using coordinates read from a screenshot.
- **Found:** the screenshot was 800 px wide but the viewport 692 CSS px; `aria-pressed` stayed on the store's random default "128 GB".
- **Fix:** options are selected by role/label locator and checked with `aria-pressed="true"` before asking for a price.

### 3. Read stale React state as ground truth (fixture capture)
- **Mistake:** the capture probe read the decoded quote from React internals and picked a stale copy of the component.
- **Found:** the first check per product recorded `phase: "loading"` while the panel was already `offer-ready`.
- **Fix:** ground truth is the DOM after explicit waits plus the quote network response. Fixtures and tests contain no React-internal data.

### 4. Secret guard too broad, then silently weakened (fixture export)
- **Mistake:** the export's secret guard matched the word "cookie" (the consent dialog's text); the `sed` edit meant to fix it stripped the regex backslashes.
- **Found:** export error `secret-like content in consent-dialog`; the edited regex no longer matched `Bearer <token>`.
- **Fix:** rewrote it as `/bearer\s|authorization|set-cookie|"pass"\s*:|R0VUfC/i` and added the same scan to `apps/server/test/fixtures.test.js`.

### 5. Invisible characters typed into source, twice (fixture test, probe)
- **Mistake:** a fixture test compared displayed text with raw `outerHTML`, and its first fix put a literal U+00A0 into the test. Later the probe's price regex was written with literal U+00A0 and U+200B.
- **Found:** the test failed on the correct `Rs. 1,393.00` fixture (`outerHTML` writes `&nbsp;`); `od -c` and a code-point scan showed the raw bytes.
- **Fix:** decode `&nbsp;` before comparing; use `String.fromCharCode(0xa0)`, a named `ZERO_WIDTH_SPACE` constant and `\s`. Re-scanned to zero.

### 6. Created and pushed the repository on the wrong GitHub account (setup)
- **Mistake:** created the repo with the `gh` CLI without checking the logged-in account; it was my company account, not my personal one.
- **Found:** a later `git push` failed with `Permission to Vishesh-Gudz/pricepulse.git denied to VTCodeCraft`.
- **Fix:** created `VTCodeCraft/pricepulse`, pointed `origin` at it and pushed the same history.

### 7. Test harness sent a malformed secret header (Render probe)
- **Mistake:** the harness read the probe secret with `grep DEBUG_PROBE_SECRET .env`, which also matched a comment line.
- **Found:** all 9 first probes returned `HTTP 400` in 0.02 s; the "secret" was 116 characters instead of 32.
- **Fix:** match only `^DEBUG_PROBE_SECRET=`; the rerun passed 9/9. The probe route was removed after the measurement.

### 8. Structure check rejected a normal loading state (scraper)
- **Mistake:** `checkDomContract` required a price button in every panel state.
- **Found:** the test on the real `state-retrying-injected` fixture failed: while retrying, the panel shows a spinner and no button.
- **Fix:** the button is required only in the locked, ready and failed states.

### 9. Browser launch failures were unreadable and mislabelled (scraper)
- **Mistake:** a failed Chromium launch surfaced as `unexpected` with Playwright's full call log in every log line.
- **Found:** the first headed run on Windows printed three pages of launch arguments for `spawn UNKNOWN`.
- **Fix:** `launchBrowser` throws `browser_launch_failed`; all Playwright errors are cut to their first line.

### 10. A failed run could leave an attempt "in progress" forever (runner)
- **Mistake:** the first runner draft marked a failed run `failed` but left its unfinished attempt without an outcome; the reaper only looks at runs still `running`.
- **Found:** reviewing the runner's error path against the reaper query before the first live run.
- **Fix:** `failUnfinishedAttempts(runIds)` (now in `scrape-attempts.repository.js`), used by the reaper and the runner's failure path.

### 11. Search could never load the catalogue (API)
- **Mistake:** `products.catalog_synced_at` defaulted to `now()`, and search treated "any products" as "catalogue loaded"; tracking inserts products, so the sync never started.
- **Found:** a live smoke test returned `catalog.count: 3` (the tracked products) and no results for "drum".
- **Fix:** migration `002_catalog_synced_at_nullable.sql`; only products seen by a full sync count.

### 12. SQL parameter typed as integer by a literal (API)
- **Mistake:** `coalesce($5, 5)` let PostgreSQL infer `$5` as an integer.
- **Found:** a live `POST /api/tracked` with `priceDropThresholdPct: 7.5` returned 500 (`invalid input syntax for type integer`).
- **Fix:** `coalesce($5::numeric, 5)`; the API test tracks with a fractional threshold.

### 13. Diagnosed failing cron calls by guessing (schedule)
- **Mistake:** concluded from curl measurements that cold starts fit cron-job.org's 30 s limit, then guessed in turn at the time zone, "requests never reach the app" and a bot challenge when calls failed with "output too large".
- **Found:** reproducing with different `Accept` headers against a sleeping instance: Render serves a 258 KB loading page to requests that accept `text/html`. curl's `*/*` never met it.
- **Fix:** both cron jobs send `Accept: application/json`; the wake job runs at minutes 50 and 55.

### 14. A dead run blocked every later trigger (API, found in production)
- **Mistake:** HTTP triggers answered 409 whenever a run was `running`; stale-run cleanup ran only after that check.
- **Found:** run 19 stayed `running` after its instance crashed (entry 15); a regression test with a 20-minute-old heartbeat got 409.
- **Fix:** `refuseIfRunning` closes stale runs before checking; tests cover the cron call and a manual scrape.

### 15. The consent handler could crash the process (scraper, found in production)
- **Mistake:** the `page.addLocatorHandler` callback could reject; Playwright calls it from an event listener, so the rejection was unhandled and Node exited.
- **Found:** Render log: `locator.click: Target page, context or browser has been closed`, `triggerUncaughtException`, "Exited with status 1". Reproduced locally by closing the context mid-click.
- **Fix:** the consent handler and fault-injection route handlers catch their own errors; the scrape's awaited action still fails and is classified. Tests cover a closed page.

### 16. The first layout ignored the tablet requirement (frontend)
- **Mistake:** switched to the mobile drawer below 900 px, although the brief asked for a collapsible sidebar on tablets.
- **Found:** the browser check at 768 px showed only the menu button.
- **Fix:** collapsible sidebar from 900 px, icon-only sidebar at 600–899 px, drawer below 600 px.

### 17. A dashboard figure taken from counters that can be wrong (frontend)
- **Mistake:** KPIs summed run counters, which a crashed run never writes: 39 successes and 0 failures in 24 h.
- **Found:** cross-checking Supabase: abandoned run 19 had 2 successful and 1 interrupted attempt outside its counters; the true figures were 41 and 1.
- **Fix:** KPIs count outcomes from the attempt log, the same table as history and CSV. The counters themselves are still not recounted (known gap).

### 18. An animated number that showed 0 (frontend)
- **Mistake:** the KPI count-up started at 0 and relied on animation frames.
- **Found:** in a background tab all four cards read 0 while the API had returned 10 products.
- **Fix:** the real value renders at once; easing only happens between values.

### 19. Cached data hidden behind an error (frontend)
- **Mistake:** the product page's option card checked `isError` before its data; after a failed background refresh React Query keeps the data and reports the error.
- **Found:** with the local API stopped, a focus refetch failed and the card showed an error while the sections below still used the same cached data.
- **Fix:** on the product page an error is shown only when there is no data. Still open: the tracked-products table and the KPI strip show their error instead of the cached data after a failed refresh.

### 20. Partial results shown while still loading (frontend)
- **Mistake:** Scrape Logs rendered as soon as the first options' logs arrived.
- **Found:** `/logs?tracked=3` read "0 of 5 attempts" until that option's log arrived.
- **Fix:** the skeleton stays until every option's log has loaded or failed.

### 21. A test started a download without asking (frontend)
- **Mistake:** while testing the command palette, arrow keys wrapped to "Export CSV" and Enter fetched the production CSV.
- **Found:** the toast "Scrape history exported · pricepulse-scrape-history-…csv". It was a read-only GET, and no file was saved.
- **Fix:** download handling was intercepted for the remaining checks; navigation was re-tested with a single-result query.

### 22. Two failure paths that never recovered (frontend)
- **Mistake:** Settings → Scraping showed skeletons forever when its query failed; Analytics' "Try again" refetched only the first failed query.
- **Found:** with the local API stopped and restarted.
- **Fix:** Scraping shows its own error and retry; "Try again" refetches every query without data.

### 23. A build config that only type-checked on the development machine (frontend)
- **Mistake:** `vite.config.ts` used `node:fs` and `process.env`; Node's types came only from a stray `@types/node` in a parent folder.
- **Found:** GitHub Actions run 36318312388 failed with "Cannot find name 'process'"; a clean clone outside the home folder reproduced it.
- **Fix:** import `package.json` directly and read the commit from `VITE_VERCEL_GIT_COMMIT_SHA`; the clean clone then passed.

### 24. A workflow pushed unchecked, then a guessed fix (CI/CD)
- **Mistake:** the actionlint job was pushed without running actionlint. When it failed (logs need a signed-in account), the first fix was a guess. The annotation template then used `{{"\n"}}`, although actionlint expands `\n` itself.
- **Found:** runs 36330211343 and 36330439081 failed; 36330579608 annotated "unterminated quoted string"; 36330697278 showed the real finding, SC2016 on the step's own template.
- **Fix:** actionlint runs from its pinned script and reports findings and fatal errors as annotations; SC2016 is disabled on that line with a reason. Run 36330808885 passed.

### 25. A doc that contradicted a check just made (CI/CD)
- **Mistake:** `docs/deployment.md` said to create `apps/frontend/vercel.json` right after `ls` had shown it exists.
- **Found:** reviewing the doc against the `ls` output.
- **Fix:** the doc says to add the key to the existing file.

### 26. A test that would fail near every hour (scheduler)
- **Mistake:** a runner test asserted that a second tick finds nothing due, ignoring the 5-minute scheduler tolerance.
- **Found:** reviewing `isDue` before committing: an hourly option within 5 minutes of its slot is due.
- **Fix:** removed the assertion; the "overdue option runs once" test covers repeated ticks.
