# AI Log

How AI tools were used on PricePulse, and every real mistake they made. Entries are added when a mistake is
found, with evidence. This file feeds the "What AI got wrong" section of the design note.

## AI usage

Claude Code (Claude Opus 5.5, desktop app) wrote the code, tests and documentation in this repository under my
direction, and ran the commands (tests, deployment checks, git). I set the scope and the phase order, reviewed every
phase before approving its commits, and did the account and dashboard work. Commits are made under my GitHub account
without AI trailers; this file is the disclosure.

| Phase | Claude Code | Me |
|---|---|---|
| Planning | Read the assignment; inspected the mock store (HTTP, JS bundle, API probing, throwaway Playwright probes); drafted the architecture and plan | Chose the scope (all bonuses) and the repo conventions |
| 0 Repo | Scaffolded the pnpm + Turborepo monorepo and the CI workflow | Created the GitHub repository |
| 1 Fixtures | Captured the fixtures; wrote the fixture tests and store notes | Had the React-internals capture and recon leftovers removed |
| 2 Render gate | Wrote the Dockerfile and a temporary probe route, measured it on Render, then removed the probe | Created the Render service and its environment variables |
| 3 Scraper | Wrote the scraper, parser, page-structure checks, retry policy, fault injection, CLI and tests | Reviewed |
| 4 Database | Wrote the schema, migrations, scheduler, runner and tests | Asked for one commit per step |
| 5 API | Wrote the HTTP API, catalogue sync, CSV export and integration tests; verified Render and Supabase | Created the Supabase project, added its CA certificate, enabled Enforce SSL, set `DATABASE_URL` on Render |
| 6 Schedule | Chose the tracked options, measured Render cold starts, traced the failing cron calls to Render's loading page, checked the cron runs in Supabase, fixed the two bugs the first production runs exposed (entries 15 and 16), wrote the scheduling notes | Created and configured the two cron-job.org jobs (method, headers, schedules) and ran their test runs; chose to track 10 options |
| Structure cleanup | Split `routes.js` and `db.js` and moved the server modules into `routes/`, `middleware/`, `services/`, `scheduler/`, `scraper/`, `db/` and `utils/` without changing behavior; compared recorded API responses before and after | Asked for the cleanup and set the target layout |
| 7 Frontend (F1) | Set up the TypeScript + MUI app shell: theme tokens, sidebar, header, routes, shared loading/empty/error states, route code-splitting; checked it in the browser at 1440/1024/768/375 px | Set the stack, structure, design direction and batch order |
| 7 Frontend (F2) | Built the API layer, response types, React Query hooks, the dashboard KPIs and the tracked-products table with refresh and untrack; checked the numbers against Supabase and the flows against the local API | Reviewed; set the rule that no metric may be invented |
| 7 Frontend (F3) | Built catalogue search, the Track Product dialog (explicit option choice, review, tracking), the product page with per-option tracking state, and their tests; checked them against the production API (read-only) and the local API (changes) | Reviewed; asked that nothing be pre-selected and production data not be changed |

## Mistakes

### 1. Loaded the price in a hidden browser tab (store inspection)
- **Mistake:** tried to unlock and load a price in Claude Code's built-in browser pane while the pane was hidden.
- **Evidence:** `document.visibilityState` was `hidden`; the panel stayed "Price locked" with the button disabled even though trusted `mousemove` events reached it.
- **Fix:** ran the same steps in a real Playwright page; the price loaded.
- **Lesson:** the scraper always drives its own foreground/headless Playwright page, never a background tab.

### 2. Clicked an option by screenshot coordinates (store inspection)
- **Mistake:** clicked "64 GB" using coordinates read from a screenshot.
- **Evidence:** the screenshot was 800 px wide but the page viewport was 692 CSS px (devicePixelRatio 1.375); afterwards `aria-pressed` was still true on the store's random default "128 GB".
- **Fix:** clicked through the element's accessibility reference; `aria-pressed` moved to "64 GB".
- **Lesson:** select options with role/label locators and check `aria-pressed="true"` before asking for a price.

### 3. Read stale React state as ground truth (Phase 1 probe)
- **Mistake:** the capture probe read the store's decoded quote from React internals and picked the stale copy of the component.
- **Evidence:** the first check on each product recorded `phase: "loading"` while the panel was already `offer-ready`.
- **Fix:** corrected the probe for the recon cross-check only; it then matched the DOM in 24 of 24 checks. Fixtures and tests no longer contain or depend on any React-internal data.
- **Lesson:** ground truth is the DOM after explicit waits plus the quote network response.

### 4. Secret guard too broad, then silently weakened (Phase 1 export)
- **Mistake:** the fixture export guard first matched the word "cookie" (rejecting the consent dialog's UI text), and the `sed` edit meant to fix it stripped the regex backslashes.
- **Evidence:** export error `secret-like content in consent-dialog`; the edited guard read `/bearers|…|"pass"s*:|R0VUfC/i`, which no longer matches `Bearer <token>`.
- **Fix:** rewrote it in an editor as `/bearer\s|authorization|set-cookie|"pass"\s*:|R0VUfC/i` and added the same scan to `apps/server/test/fixtures.test.js`.
- **Lesson:** re-read security checks after every edit; keep the scan in the test suite.

### 5. Compared displayed text with raw HTML (Phase 1 test)
- **Mistake:** the fixture test expected the displayed price text to appear verbatim in the saved `outerHTML`; the first fix then put an invisible U+00A0 character into the test source.
- **Evidence:** the test failed on the correct `Rs. 1,393.00` fixture because `outerHTML` writes U+00A0 as `&nbsp;`; `od -c` showed bytes `302 240` in the source.
- **Fix:** decode `&nbsp;` before comparing, written as `String.fromCharCode(0xa0)`.
- **Lesson:** the price parser must treat U+00A0 as a space and work on text content, not serialized HTML.

### 6. Created and pushed the repo on the wrong GitHub account (Phase 0)
- **Mistake:** created the GitHub repo with the `gh` CLI without checking which account it was logged into; it was my company account (`Vishesh-Gudz`), not my personal one.
- **Evidence:** a later plain `git push` failed with `Permission to Vishesh-Gudz/pricepulse.git denied to VTCodeCraft`, which showed two different accounts were in use.
- **Fix:** created `VTCodeCraft/pricepulse`, pointed `origin` at it, and pushed the same history there.
- **Lesson:** confirm the target account/owner before any action that publishes code.

### 7. Invisible characters in a regex, again (Phase 2 probe)
- **Mistake:** the probe's price parser was written with a literal U+00A0 and U+200B inside a regex character class, repeating mistake 5.
- **Evidence:** a code-point scan of `src/debug/probe.js` found 1 NBSP and 1 zero-width space; `od -c` showed the raw bytes in the regex.
- **Fix:** replaced them with a named `ZERO_WIDTH_SPACE = String.fromCharCode(0x200b)` constant and `\s` (which already covers U+00A0); re-scanned to 0.
- **Lesson:** never type invisible characters into source; use named constants and scan new files for them.

### 8. Test harness sent a malformed secret header (Phase 2 gate run)
- **Mistake:** the script that called the local probe read the secret with `grep DEBUG_PROBE_SECRET .env`, which also matched a comment line, so the header contained a newline.
- **Evidence:** all 9 first-run probes returned empty bodies; a verbose retry showed `HTTP 400` in 0.02 s and a 116-character "secret" instead of 32.
- **Fix:** match only `^DEBUG_PROBE_SECRET=` and take everything after the first `=`; the rerun passed 9/9.
- **Lesson:** check a harness's inputs before trusting its results; an instant 400 means the request never reached the code under test.

### 9. Page-structure check rejected a normal loading state (Phase 3)
- **Mistake:** `checkDomContract` required a price button inside the panel in every state.
- **Evidence:** the test on the real `state-retrying-injected` fixture failed: while the store is retrying, the panel shows a spinner and has no button. In production this would have reported `layout_changed` mid-retry.
- **Fix:** require the button only in the locked, ready and failed states.
- **Lesson:** check structural rules against every captured state, not only the happy path.

### 10. Browser launch failures were unreadable and mislabelled (Phase 3)
- **Mistake:** a failed Chromium launch surfaced as `unexpected` with Playwright's full multi-line call log in every log line.
- **Evidence:** the first headed run on Windows printed three pages of launch arguments for `spawn UNKNOWN`.
- **Fix:** `launchBrowser` throws `browser_launch_failed` with the first line only; all Playwright errors are cut to their first line.
- **Lesson:** error messages are part of the product: one line, a clear code.

### 11. A failed run could leave an attempt "in progress" forever (Phase 4)
- **Mistake:** the first runner draft marked a run `failed` when the database or browser failed mid-run, but left that run's unfinished attempt with no outcome. The stale-run reaper only looks at runs still marked `running`, so that attempt would never have been closed.
- **Evidence:** found while reviewing the runner's error path against the reaper query (`where status = 'running'`) before the first live run.
- **Fix:** a shared `failUnfinishedAttempts(runIds)` in `db.js`, used by both the reaper and the runner's failure path; unfinished attempts become `failed` / `interrupted` with no price.
- **Lesson:** every exit path of a run must leave each attempt with a final, honest outcome.

### 12. Search could never load the catalogue (Phase 5)
- **Mistake:** the Phase 4 schema gave `products.catalog_synced_at` a default of `now()`, and the Phase 5 search treated "no products" as "catalogue not loaded". Tracking a product inserts it into `products`, so the catalogue looked loaded and the automatic sync never started.
- **Evidence:** a live smoke test returned `catalog.count: 3` and no results for "drum"; the 3 rows were the tracked products.
- **Fix:** migration `002_catalog_synced_at_nullable.sql` makes the column NULL unless a full catalogue sync saw the product; `catalogStatus` counts only synced rows.
- **Lesson:** a column that records an event should stay empty until that event happens; defaults can make "never happened" look like "happened now".

### 13. SQL parameter typed as integer by a literal (Phase 5)
- **Mistake:** `coalesce($5, 5)` in the insert for tracked options let PostgreSQL infer `$5` as an integer from the literal `5`.
- **Evidence:** a live `POST /api/tracked` with `priceDropThresholdPct: 7.5` returned 500; the log showed `invalid input syntax for type integer: "7.5"`.
- **Fix:** `coalesce($5::numeric, 5)`; the API test now tracks with a fractional threshold.
- **Lesson:** cast parameters explicitly when a literal sits next to them; test with realistic values, not only round numbers.

### 14. Diagnosed the failing cron calls by guessing (Phase 6)
- **Mistake:** the AI measured Render cold starts with curl and concluded that a ~14 s cold start fits cron-job.org's 30 s limit. When the scheduled calls then failed with "output too large", it guessed at causes in turn: the job's time zone, "the requests never reach the app, awake or asleep" (because no run appeared), and a bot or challenge page aimed at cron-job.org's servers.
- **Evidence:** the job was already set to UTC; a request that reaches the app but gets `401` also creates no run, and once the scrape job's method and `Authorization` header were fixed its calls to an awake instance created runs. The real cause was Render's 258 KB "Application loading" page, served to any request whose `Accept` header includes `text/html` while the instance is asleep. curl sends `Accept: */*`, so the cold-start tests never met that page.
- **Fix:** reproduced the failure by sending requests with different `Accept` headers to a sleeping instance; both cron-job.org jobs now send `Accept: application/json`, and the wake job runs at minutes 50 and 55.
- **Lesson:** test with the real client's request, headers included, and read what the client received before naming a cause.

### 15. A run left by a dead process blocked every later trigger (Phase 5 code, found in Phase 6)
- **Mistake:** the HTTP triggers answered 409 as soon as any run was marked `running`. The cleanup of runs whose heartbeat stopped lived only inside `startTick`, which runs after that check, so a dead run was never cleaned up by an HTTP trigger.
- **Evidence:** run 19 stayed `running` after its instance crashed at 08:08 UTC on 2026-09-27 (entry 16). A regression test with a run whose heartbeat is 20 minutes old got 409 from `POST /api/scrape/run`.
- **Fix:** `refuseIfRunning` closes stale runs before it checks; the test covers the cron call and a manual scrape.
- **Lesson:** every place that checks a lock has to apply the same expiry rule as the place that takes it.

### 16. The cookie-consent handler could crash the whole process (Phase 3 code, found in Phase 6)
- **Mistake:** the handler registered with `page.addLocatorHandler` could reject. Playwright calls it from an event listener and does not catch its errors, so a rejection is unhandled and Node exits. The scraper's `try/catch` cannot see it.
- **Evidence:** Render log at 08:08 UTC on 2026-09-27: `locator.click: Target page, context or browser has been closed` on the "Reject cookies" button, `triggerUncaughtException(err, true /* fromPromise */)`, then "Instance failed ... Exited with status 1", which killed run 19. Reproduced with real Playwright by closing the context while the handler waited on the button: exit code 1 with the old handler; with the fixed one the process stays up and the scrape fails as `browser_crash`.
- **Fix:** the consent handler and the fault-injection route handlers (called the same way) catch their own errors; the scrape's own awaited action still fails and is classified. Tests cover a closed page for both.
- **Lesson:** a callback that a library invokes from an event listener must not throw; check how a library calls your code before relying on `try/catch` around it.

### 17. The first shell ignored the tablet requirement (Phase 7, F1)
- **Mistake:** the first layout switched to the mobile drawer below 900 px, although the brief asked for a collapsible sidebar on tablets and a drawer only on mobile.
- **Evidence:** at 768 px the browser check showed the menu button and no sidebar.
- **Fix:** three widths now: from 900 px a sidebar the user can collapse; 600–899 px an icon-only sidebar; below 600 px the drawer. Re-checked at 768 and 375 px.
- **Lesson:** check each breakpoint against the brief, not only that the layout works.

### 18. A dashboard figure taken from counters that can be wrong (Phase 7, F2)
- **Mistake:** the first KPI version summed each run's success/retried/failed counters. A run cut off by a crash never writes them, so the dashboard showed 39 successful scrapes and 0 failures for the last 24 hours.
- **Evidence:** cross-checking against Supabase: run 19 (abandoned when its instance crashed) has 2 successful attempts and 1 failed (`interrupted`) that its counters do not include. The true figures were 41 and 1.
- **Fix:** the KPIs count outcomes from each tracked option's attempt log, the same table the history and CSV use. The backend gap stays open: the stale-run cleanup does not recount an abandoned run's counters.
- **Lesson:** check a derived number against the source of truth before showing it.

### 19. An animated number that showed 0 (Phase 7, F2)
- **Mistake:** the KPI count-up started every number at 0 and relied on animation frames to reach the real value.
- **Evidence:** with the page in a background tab (no animation frames), all four cards read 0 while the API had returned 10 tracked products.
- **Fix:** the number renders the real value at once and only eases between values when the data changes.
- **Lesson:** decoration must never change what a data display says, even for a moment.
