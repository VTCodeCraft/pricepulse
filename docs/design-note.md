# PricePulse design note

PricePulse tracks the price and stock of chosen product options in INE's demo store
(<https://demo.inelabteamdev.com>). The rule behind every decision: a stored price must be the price the store
showed for exactly that option at that moment. When that cannot be established, the attempt is recorded as failed,
with no price and no stock.

## 1. Scraping architecture

The store serves catalogue data as plain JSON: `/api/v2/listings`, `/api/v2/items/{id}` (options, labels, specs) and
`/api/v2/ui/manifest`. PricePulse uses these directly over HTTP, one request at a time with a 1.1 s gap, for search,
product details and checking that an option exists.

Price and stock are not available that way. The page gets them through a handshake (proof of work, WebAssembly,
browser fingerprint, mouse telemetry), then a short-lived pass and an encrypted quote. PricePulse does not
reimplement or bypass this. Playwright drives the real page like a user:

1. Dismiss the consent dialog whenever it appears (it is delayed and sometimes needs several clicks).
2. Click the requested option chip and confirm `aria-pressed="true"`. The store picks a random default option.
3. Move the pointer over the price panel until the button unlocks, then click until the page starts its handshake
   (some clicks are ignored on purpose).
4. Wait for a ready or failed panel, read price and stock with `textContent` using the class names from the page's
   own manifest, and parse the store's rotating formats (`₹`, `Rs. x.00`, "/- (incl. of all taxes)", full-width
   digits, split spans, no-break and zero-width spaces).

Store behaviour and the traps it sets are recorded in `apps/server/docs/store-notes.md`.

## 2. Reliability

- **Validation before storage.** A value is stored only if all of these hold:
  - the chip for the requested option is still pressed after the price loads;
  - the last quote response received after our click is HTTP 200, and both its URL and its body name the requested
    product and option;
  - exactly one visible price element matches the manifest selector. Hidden decoys (`.price-value`,
    `.amount[data-price]`), the MRP and the "Member price" are recorded as evidence, never used as the price;
  - the price is not in the "Refreshing prices" pending state. The page shows a wrong transitional value there
    (about 21% of quotes), so it is re-checked up to 3 times and then rejected.
- **Retries.** Up to 3 tries per option. Backoff is 5 s, then 15 s, with ±20% jitter. Each try runs in a fresh
  browser context under a 120 s watchdog. Permanent errors (`product_not_found`, `option_not_found`,
  `store_rejected`) are not retried.
- **Outcomes.** Each attempt ends as one of three outcomes:
  - `success`: clean on the first try.
  - `retried`: valid data, but only after our retry, the page's own retry of a 5xx quote, or a pending re-check.
  - `failed`: the error code and each try's details are kept.

  The database enforces this: a `failed` attempt with a price, or a `success` without price, stock and currency, is
  rejected (`observation_matches_outcome`).
- **Slow and failed responses.** Navigation, the quote and each try have their own timeouts. Store 429/5xx on JSON
  calls are retried with backoff. Playwright errors are cut to one line with a stable code (`timeout`,
  `browser_crash`, `network`, `click_ignored`, …).
- **Browser lifecycle.** A run launches Chromium once and relaunches it if it crashes. Each product gets one
  context and each option its own page. Everything is closed in `finally`. Callbacks that Playwright calls from
  event listeners (the consent handler, fault-injection routes) catch their own errors, because an unhandled
  rejection there would exit Node (AI log 10).
- **Several options of one product.** A run groups due options by product: one HTTP preflight and one shared
  browser context (cookies, cache, the consent choice). Every option still gets its own page load, option check,
  quote check, attempt row and retries. A retry uses a fresh context, and the runner refuses to store a result
  whose product or option differs from the tracked one.
- **One run at a time.** A partial unique index allows only one `scrape_runs` row with status `running`, so a
  second trigger fails to insert and gets `409`. Runs send a heartbeat after each option. A run whose heartbeat is
  older than 15 minutes (its process died) is closed as `abandoned` before any new trigger is checked. Its
  unfinished attempts become `failed` / `interrupted`.
- **Fault injection.** `--inject quote:503x6` and similar commands let a demo show retries and failures. It is
  refused when `NODE_ENV=production`.

## 3. Scheduling

- **Intervals.** Each tracked option has an interval: 60, 120 (default), 240, 360, 720 or 1440 minutes. The API
  and a database check allow only these values. Users change it on the product page.
- **UTC alignment.** Slots are multiples of the interval counted from 00:00 UTC. With the 120-minute default an
  option runs at every even UTC hour, and the schedule never drifts.
- **Trigger.** cron-job.org calls `POST /api/scrape/run` (Bearer `CRON_SECRET`) every hour at minute 0. The server
  decides what is due; a call with nothing due still records an empty run.
- **Missed ticks.** An overdue option runs once, and its next slot is the first slot after both the missed slot
  and the time it ran. A missed call delays a 2-hour scrape by one hour, not two.
- **Manual scrapes.** A manual scrape moves an option's slot only if the option was already due, so it never
  pushes a scheduled scrape further away. Manual scrapes have a 10-minute cooldown per option.
- **Free-tier sleep.** Render's free instance sleeps after 15 idle minutes. A second job wakes it at minutes 50
  and 55. Both jobs send `Accept: application/json`, because while the instance is waking Render answers HTML
  requests with a 258 KB loading page (AI log 8).

## 4. Database

PostgreSQL on Supabase, reached through the session pooler with verified TLS. Every table has RLS enabled and no
policies, so the public Supabase REST API can read nothing. Migrations live in `apps/server/db/migrations` and run
on server start.

| Table | Why it exists |
|---|---|
| `products` | Catalogue and product details cache: search, option labels, specs |
| `tracked_products` | One row per product + option. Holds the interval, next slot, price-drop threshold and active flag. Untracking keeps the row and its history |
| `scrape_runs` | One row per trigger (cron, manual, initial, CLI). The run lock, heartbeat and counters |
| `scrape_attempts` | One row per option per run. The single source for price history, the scrape log, CSV export and alerts |
| `layout_versions` | Every store manifest seen, and the page-structure fingerprint recorded with it |
| `alerts` | In-app alerts, unique on `(type, dedupe_key)` |

## 5. Page-structure change detection

The store rotates its CSS class names and publishes the current ones in the manifest, which is valid for about 30
minutes. The price
element's tag (`span` / `data`), the fact order and some random classes also change. Two fingerprints are kept:

- **Manifest shape.** Key names and value types only (`schema_hash`). A routine rotation leaves it unchanged; a
  new or removed manifest key changes it.
- **Page structure.** For each successful scrape, taken from the ready price panel: the paths from the panel to
  the price, the stock and the price button, written as tag names and stable class names.
  - Classes named in the manifest become their key (`priceValue`, `stock`).
  - Generated class names (with digits) are dropped.
  - Element contents are never read.

  So a new price, stock text, price format, fact order or class rotation gives the same fingerprint. Moving the
  price or stock to a different container, or losing the button, changes it.

Each fingerprint is compared with the last one seen and stored on the attempt's `layout_versions` row. A change
raises a `structure_changed` alert with both signatures and the changed parts. `GET /api/layout` reports
`unchanged`, or `changed` until that alert is read. Before any of this, a fixed set of DOM anchors (panel, button,
option chips) is checked on every page load; if they are missing, the attempt fails as `layout_changed` instead of
guessing.

## 6. Alerts

The runner compares each new validated observation with the option's previous validated one. It reads the
previous one before storing the new one.

- **`price_drop`:** the new price is lower, in the same currency. Every drop is recorded. A drop at or past the
  option's threshold (5% by default) is a `warning`, a smaller one is `info`.
- **`back_in_stock`:** the previous stock was 0 and the new stock is above 0.

Failed attempts carry no values, so they can neither raise an alert nor serve as the "previous" observation. The
dedupe key is the attempt id, so one observation alerts at most once. Alerts are in-app only (Settings → Alerts and
the dashboard). No email is sent; `email_status` stays `not_configured`.

## 7. Trade-offs

- **Playwright over HTTP for prices.** It is slower (12–42 s per option on Render's 0.15 CPU, median 17 s) and takes a lot of
  memory, but the price flow needs a real browser. Only one browser runs at a time, within Render's 512 MB.
- **Sequential options.** Options are scraped one after another with a gap between products. This gives up speed
  for correctness and for staying under the store's rate limits (bursts get 429 and then nginx 503).
- **External cron.** Free hosting sleeps, so an in-process timer would not fire. The server owns the schedule and
  the external caller only wakes it, so a late or doubled call cannot double-scrape.
- **Recording failures.** An option that fails all tries has a gap in its history and a `failed` row in the log.
  No guessed value is stored.
- **Structure fingerprint limits.** It deliberately ignores contents, optional elements (member price, badge) and
  fact order. It catches moved or missing price, stock and button elements, not cosmetic changes elsewhere on the
  page.
- **Known gaps.**
  - Run counters are not recounted when a crashed run is abandoned; the dashboard counts outcomes from attempts
    instead.
  - `store_app_updated` alerts are defined but never raised.
  - The GitHub Actions deploy job needs Render and Vercel secrets. Until they are set, the platforms' own
    auto-deploy is used (`docs/deployment.md`).

## 8. AI usage

AI-assisted tools (Claude, OpenCode, Google Antigravity, Kiro and GitHub Copilot) supported exploration, debugging,
implementation, testing, documentation and iteration. Every change was reviewed and verified before it was
committed. `docs/AI_LOG.md` lists the concrete AI mistakes that were caught and how each was corrected. They fall
into a few patterns:

- **Wrong source of truth:** React internals instead of the DOM, run counters instead of attempts.
- **Guessing before reading the evidence:** the cron failures, a CI failure.
- **Checks that passed only on the development machine:** a stray `@types/node` in a parent folder.
- **Error paths never exercised:** the stale-run lock, the process-killing consent handler.

They were caught by tests on captured store fixtures, by cross-checking figures against the database, and by
production logs.
