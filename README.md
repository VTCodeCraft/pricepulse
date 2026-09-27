# PricePulse

Price and stock tracker for INE's demo store (<https://demo.inelabteamdev.com>). Search the catalogue, pick a
product option, and PricePulse scrapes that option's price and stock on a schedule. It keeps a validated history
and a log of every attempt, failures included.

| | |
|---|---|
| Live site | <https://pricepulse-smoky.vercel.app> |
| API | <https://pricepulse-bgxj.onrender.com/api/health> (free Render instance: the first request after idle can take ~50 s) |
| Design note | [`docs/design-note.md`](docs/design-note.md): reliability, trade-offs, AI mistakes |
| AI usage record | [`docs/AI_LOG.md`](docs/AI_LOG.md) |

## Features

**Core**
- Catalogue search by product name (960 products), with product details and options from the store.
- Track any option of a product, or several at once. The first scrape starts immediately, then follows the schedule.
- Scrapes run in Playwright through the store's real page and handshake. Only validated values are stored.
- Price and stock history chart, and a scrape log of every attempt with its outcome: `success`, `retried` or
  `failed`.
- CSV export: `store_product_id, product_name, selected_option, timestamp, price, stock, outcome`.
- Dashboard, analytics, settings, light/dark theme. The layout works on phone, tablet and desktop.

**Bonus**

| Bonus | Implementation |
|---|---|
| Price-drop and back-in-stock alerts | In-app alerts raised by the runner from validated observations only, one per observation. Shown in Settings → Alerts and on the dashboard (no email) |
| Dashboard across tracked products | Key figures, tracked-options table, latest price drops and restocks, biggest price moves, recent scrape activity |
| Page-structure change detection | A structural fingerprint of the price panel that ignores prices, formats and CSS class rotation. A change raises an alert and shows in Settings → Scraping |
| Configurable scrape frequency | Per option: every 1, 2 (default), 4, 6, 12 or 24 hours, UTC-aligned, set on the product page |
| Several options of a product in one run | A run groups options by product: one store lookup and one browser session per product, and each option gets its own attempt, checks and retries |
| CI/CD with GitHub Actions | CI runs lint, typecheck, tests (with PostgreSQL), build and actionlint. The deploy workflow runs only after CI passes on `main` |

## Architecture

```
Vercel: React SPA ──HTTPS──► Render: Express API ──► Supabase PostgreSQL
                                 │  scheduler + runner (one run at a time, DB lock)
cron-job.org ──POST /api/scrape/run (hourly, Bearer CRON_SECRET)
                                 │
                                 ├─ HTTP: store JSON (catalogue, items, layout manifest)
                                 └─ Playwright Chromium: product page → handshake → quote → validated price/stock
```

**Stack**
- Backend: Node 22, Express 5, `pg`, Playwright 1.63 (Docker image `mcr.microsoft.com/playwright`), linkedom.
- Frontend: React 19, TypeScript, Vite, MUI, TanStack Query, React Router, Recharts, React Hook Form + Zod.
- Tooling: pnpm workspaces, Turborepo, Vitest, ESLint, GitHub Actions.

## Repository layout

```
apps/
  server/     Express API, scheduler, runner and Playwright scraper   → Render (apps/server/Dockerfile)
    src/        routes/ services/ scheduler/ scraper/ db/ middleware/ utils/
    db/         SQL migrations (applied on server start)
    test/       Vitest suites and captured store fixtures
    docs/       store behaviour notes, Render/Supabase measurements
  frontend/   React dashboard                                          → Vercel (root directory apps/frontend)
docs/         design note, AI usage record, deployment and CI/CD
.github/      CI and deploy workflows
```

Each app has its own `pnpm-lock.yaml` and can be installed and run on its own without Turborepo. More detail:
[`apps/server/README.md`](apps/server/README.md) (API reference, modules) and
[`apps/frontend/README.md`](apps/frontend/README.md) (pages, data sources).

## Local setup

Requires Node 22.12+, pnpm 11 (`corepack enable`) and PostgreSQL (Docker is fine).

```bash
pnpm install                     # installs both apps
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

**Database.** Create a local database (plus a `_test` one for the database tests):

```bash
docker run -d --name pricepulse-pg -e POSTGRES_USER=pricepulse -e POSTGRES_PASSWORD=<choose one> \
  -e POSTGRES_DB=pricepulse_dev -p 55432:5432 postgres:17-alpine
docker exec pricepulse-pg createdb -U pricepulse pricepulse_test
```

**Backend** (`http://localhost:3000`):

```bash
cd apps/server
cp .env.example .env             # set DATABASE_URL (and TEST_DATABASE_URL, CRON_SECRET)
pnpm exec playwright install chromium
pnpm migrate                     # also runs automatically when the server starts
pnpm dev
```

**Frontend** (`http://localhost:5173`, an origin the API allows by default):

```bash
cd apps/frontend
cp .env.example .env             # VITE_API_URL=http://localhost:3000/api
pnpm dev
```

**Scraper from the command line** (no database needed for a single scrape):

```bash
cd apps/server
pnpm scrape -- --product 2179 --option o1                        # one scrape, headless
pnpm scrape -- --product 2179 --option o1 --headed --slow-mo 250 # watch it in a browser window
pnpm scrape -- --track --product 2179 --option o1 --interval 120 # start tracking (needs DATABASE_URL)
pnpm scrape -- --all                                             # scrape every active option through the runner
ALLOW_FAULT_INJECTION=true pnpm scrape -- --product 2179 --option o1 --inject quote:503x6   # demo retries
```

## Environment variables

Server (`apps/server/.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port (Render sets it) |
| `DATABASE_URL` | — | PostgreSQL URL. Production: Supabase session pooler + `?sslmode=verify-full&sslrootcert=certs/supabase-prod-ca-2021.crt` |
| `TEST_DATABASE_URL` | — | Database for `db.test.js` / `api.test.js`. The name must end in `_test`; its tables are dropped. Tests skip without it |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins, comma-separated (add the Vercel URL in production) |
| `CRON_SECRET` | — | Bearer token for `POST /api/scrape/run` and `POST /api/catalog/sync`. Both are disabled without it |
| `MANUAL_SCRAPE_COOLDOWN_MINUTES` | `10` | Minimum gap between manual scrapes of one option |
| `MAX_TRACKED` | `12` | Maximum active tracked options |
| `SCRAPER_MAX_TRIES`, `SCRAPER_RETRY_BASE_DELAY_MS` | `3`, `5000` | Tries per option and backoff base |
| `SCRAPER_TRY_TIMEOUT_MS`, `SCRAPER_QUOTE_TIMEOUT_MS` | `120000`, `60000` | Watchdog per try; wait for a quote |
| `STORE_REQUEST_GAP_MS` | `1100` | Gap between store JSON requests |
| `SCHEDULER_TOLERANCE_MINUTES` | `5` | A slot counts as due this many minutes early |
| `STALE_RUN_MINUTES` | `15` | A run with no heartbeat for this long is closed as abandoned |
| `RUNNER_PRODUCT_GAP_MS` | `4000` | Pause between products in a run |
| `SCRAPER_BROWSER_CHANNEL` | — | Local headed runs only: `chrome` or `msedge` instead of bundled Chromium |
| `ALLOW_FAULT_INJECTION` | — | Local demos only: allows `--inject`. Refused when `NODE_ENV=production` |

Frontend (`apps/frontend/.env.example`): `VITE_API_URL`, the API base URL including `/api`.

No real values are committed. Production values live in the Render and Vercel dashboards.

## Scraping and schedule

- **Default:** every tracked option is scraped every **2 hours**, at even UTC hours (00:00, 02:00, …).
- **Configurable per option:** 60, 120, 240, 360, 720 or 1440 minutes, on the product page or with
  `PATCH /api/tracked/:id { "scrapeIntervalMinutes": 360 }`. The next slot is re-aligned to the new interval.
- **Trigger:** cron-job.org calls `POST /api/scrape/run` with `Authorization: Bearer <CRON_SECRET>` and
  `Accept: application/json` every hour at minute 0 UTC. The server scrapes only the options whose slot has
  arrived. A call with nothing due is still recorded as an empty run.
- **Wake-up:** a second job calls `GET /api/health` at minutes 50 and 55 to wake the free instance before the
  scrape call.
- **Missed calls:** an overdue option runs once and returns to its own slots. Only one run can be active at a time
  (`409` otherwise).
- **Manual:** "Refresh price" in the UI (`POST /api/tracked/:id/scrape`), limited by the per-option cooldown.

## Correctness guarantees

- A price is stored only if all of these hold:
  - the requested option chip is still pressed after the price loads;
  - the last quote response after our click is HTTP 200 and names the same product and option in its URL and body;
  - exactly one visible price element matches the page's layout manifest. Hidden decoy prices, MRP and member
    prices are never used.
- "Refreshing prices" (pending) values are re-checked and rejected if they persist; they are never stored.
- A failed attempt is stored with `outcome = failed`, `price = NULL` and `stock = NULL`. The database rejects any
  other combination.
- Retries (up to 3 tries with backoff) stay visible: an attempt that needed one is `retried`, and each try is kept
  in the attempt's details.
- A crashed run is closed as `abandoned` and its unfinished attempts as `failed` / `interrupted`. It cannot block
  later runs.
- The server refuses to start with any store other than `demo.inelabteamdev.com` (localhost is allowed for tests).

## Testing

```bash
pnpm test                                   # both apps (Turborepo)
cd apps/server && pnpm test                 # 273 tests; database/API suites need TEST_DATABASE_URL
cd apps/frontend && pnpm test               # 79 tests (logic + jsdom component tests)
```

Server tests use captured store fixtures (`apps/server/test/fixtures`) and a real PostgreSQL database; the store and
the browser are mocked, so no test touches the live store. CI runs the full suite against a PostgreSQL 17 service.

## Deployment

| Part | Host | Notes |
|---|---|---|
| API + scraper | Render, Docker (`apps/server/Dockerfile`), Singapore | Auto-deploys `main`; migrations run on start; health check `/api/health` |
| Frontend | Vercel, root directory `apps/frontend` | `VITE_API_URL` set in the project; `vercel.json` rewrites routes to `index.html` |
| Database | Supabase PostgreSQL | Session pooler, TLS verified against the committed Supabase CA (`apps/server/certs/`) |
| Schedule | cron-job.org | Hourly trigger and wake-up calls |

`.github/workflows/deploy.yml` deploys the exact commit CI tested, only after CI passes on `main`. It needs Render
and Vercel secrets; until they are set, the platforms' own auto-deploy is used. See
[`docs/deployment.md`](docs/deployment.md). Render and Supabase measurements (memory, cold starts, TLS) are in
[`apps/server/docs/deployment-notes.md`](apps/server/docs/deployment-notes.md).
