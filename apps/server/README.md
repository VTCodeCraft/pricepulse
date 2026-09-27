# @pricepulse/server

Express API, scrape runner and Playwright scraper. Deployed to Render with `apps/server/Dockerfile`.

This app is independently runnable: it has its own `pnpm-lock.yaml`, imports no workspace package, and does not
need Turborepo.

```bash
cd apps/server
pnpm install --frozen-lockfile
pnpm test
pnpm dev                                              # API on :3000 (applies pending migrations first)
pnpm scrape -- --product 2179 --option o1            # one scrape, headless, no database
pnpm scrape -- --product 2179 --option o1 --headed   # watch it in a browser window
```

## Database

PostgreSQL (Supabase in production). Set `DATABASE_URL`, then:

```bash
pnpm migrate                                          # applies db/migrations/*.sql once each (the server also does this on start)
pnpm scrape -- --track --product 2179 --option o1     # track an option (every 120 min by default)
pnpm scrape -- --all                                  # scrape every active tracked option through the runner
```

`scrape_attempts` is the single record of every scrape: history, scrape log, CSV and alerts all read from it.
Database constraints refuse a failed attempt with a price and a successful one without.

Database tests (`test/db.test.js`, `test/api.test.js`) run against `TEST_DATABASE_URL` (the database name must end in
`_test`) and are skipped when it is not set. A local Postgres for development and tests:

```bash
docker run -d --name pricepulse-pg -e POSTGRES_USER=pricepulse -e POSTGRES_PASSWORD=<choose one> \
  -e POSTGRES_DB=pricepulse_dev -p 55432:5432 postgres:17-alpine
docker exec pricepulse-pg createdb -U pricepulse pricepulse_test
```

## Schedule

cron-job.org calls `POST /api/scrape/run` with `Authorization: Bearer <CRON_SECRET>` every hour at minute 0 UTC.
The server owns the schedule: each tracked option has an interval (120 minutes by default) whose slots are aligned to
UTC (120 minutes: every even UTC hour), and a call scrapes only the options whose slot has arrived. A call that finds
nothing due still records an empty run, so every trigger is visible in `GET /api/runs`. Calling every hour for a
2-hour schedule means a missed call delays a scrape by one hour, not two.

A second cron-job.org job calls `GET /api/health` at minutes 50 and 55 to start the free Render instance (asleep
after 15 idle minutes) before the scrape call. Both jobs send `Accept: application/json`: while the instance is
asleep, Render answers requests that accept HTML with a 258 KB loading page, which cron-job.org rejects as too
large. Measurements: `docs/deployment-notes.md`.

## API

All responses are JSON (except the CSV). Errors are `{ "error": { "code", "message", "details"? } }`.
Timestamps are ISO 8601 in UTC.

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | Process up; database status, applied migrations, last run |
| GET | `/api/catalog/search?q=&limit=` | Partial-name search (every word must match). First call on an empty catalogue starts a sync and answers 503 |
| GET | `/api/catalog/products?q=&page=&pageSize=` | The whole catalogue a page at a time (optional name filter, same matching as search), with the matching `total`; `optionCount` once a product's details were fetched |
| POST | `/api/catalog/sync` | Rebuild the catalogue in the background (Bearer `CRON_SECRET`) |
| GET | `/api/catalog/products/:storeProductId` | Live product details and options from the store |
| GET | `/api/tracked[?includeInactive=true]` | Tracked options with latest/previous observation and last attempt |
| POST | `/api/tracked` | `{ storeProductId, optionId, scrapeIntervalMinutes?, priceDropThresholdPct? }` → 201 new (first scrape starts) / 200 re-activated. With `optionIds: [...]` instead of `optionId`, several options of the product at once (all checked first, limit counted for the whole set, one first-scrape run for the new ones) → `{ tracked: [...] }` |
| GET | `/api/tracked/:id` | One tracked option with product details |
| PATCH | `/api/tracked/:id` | `{ scrapeIntervalMinutes?, priceDropThresholdPct?, isActive? }`; a new interval re-aligns the next scrape |
| DELETE | `/api/tracked/:id` | Untrack (history is kept) → 204 |
| GET | `/api/tracked/:id/history` | Validated price/stock observations, oldest first |
| GET | `/api/tracked/:id/attempts` | Scrape log: every attempt (failures included), newest first |
| POST | `/api/tracked/:id/scrape` | Manual scrape → 202 with `runId`; 409 while a run is going; 429 within the cooldown |
| POST | `/api/scrape/run` | Cron trigger (Bearer `CRON_SECRET`) → 202 with `runId`, or 409; `{ "force": true }` scrapes every active option |
| GET | `/api/runs`, `/api/runs/:id` | Run history; one run with its attempts |
| GET | `/api/alerts[?unread=true]` | Alerts; `POST /api/alerts/:id/read`, `POST /api/alerts/read-all` |
| GET | `/api/layout` | Store layout versions seen and structure-related alerts |
| GET | `/api/export.csv` | Every attempt: `store_product_id, product_name, selected_option, timestamp, price, stock, outcome` |

Scrape triggers answer immediately and the scrape runs in the background, because a run can take minutes on Render
while request timeouts are much shorter. Only one run can be active at a time (database lock).

## Layout

Entry points: `src/server.js` (API: applies migrations, then listens), `src/cli.js` (`pnpm scrape`) and
`scripts/migrate.js` (`pnpm migrate`). `src/app.js` builds the Express app; `src/config.js` holds every setting and
its environment variable (see also `.env.example`).

| Folder in `src/` | Contents |
|---|---|
| `routes/` | HTTP handlers, one file per resource: health, catalog, tracked, runs, alerts, layout, export |
| `middleware/` | CORS, the `CRON_SECRET` check, the JSON error handler |
| `services/` | Logic shared by routes and the CLI: catalogue sync, tracking an option, starting a run under the lock |
| `scheduler/` | `schedule.js` (slot alignment), `runner.js` (one scrape run) |
| `scraper/` | `store.js` (store JSON client), `browser.js` (Playwright price flow), `parser.js` (price/stock parsing), `layout.js` (manifest and page-structure checks), `retry.js` (retry policy and outcomes), `faults.js` (opt-in fault injection for demos) |
| `db/` | `client.js` (connection pool), `migrate.js`, `repositories/` (the SQL, one file per table) |
| `utils/` | `http-error.js`, `validation.js` (request checks), `serializers.js` (rows to API JSON), `csv.js` |

SQL migrations: `db/migrations/`. Store behavior: `docs/store-notes.md`. Render measurements: `docs/deployment-notes.md`.
