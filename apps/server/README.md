# @pricepulse/server

Express API, scrape runner and Playwright scraper. Deployed to Render with `apps/server/Dockerfile`.

This app is independently runnable: it has its own `pnpm-lock.yaml`, imports no workspace package, and does not
need Turborepo.

```bash
cd apps/server
pnpm install --frozen-lockfile
pnpm test
pnpm scrape -- --product 2179 --option o1            # one scrape, headless, no database
pnpm scrape -- --product 2179 --option o1 --headed   # watch it in a browser window
```

## Database

PostgreSQL (Supabase in production). Set `DATABASE_URL`, then:

```bash
pnpm migrate                                          # applies db/migrations/*.sql once each
pnpm scrape -- --track --product 2179 --option o1     # track an option (every 120 min by default)
pnpm scrape -- --all                                  # scrape every active tracked option through the runner
```

`scrape_attempts` is the single record of every scrape: history, scrape log, CSV and alerts all read from it.
Database constraints refuse a failed attempt with a price and a successful one without.

Database tests (`test/db.test.js`) run against `TEST_DATABASE_URL` (the database name must end in `_test`) and are
skipped when it is not set. A local Postgres for development and tests:

```bash
docker run -d --name pricepulse-pg -e POSTGRES_USER=pricepulse -e POSTGRES_PASSWORD=<choose one> \
  -e POSTGRES_DB=pricepulse_dev -p 55432:5432 postgres:17-alpine
docker exec pricepulse-pg createdb -U pricepulse pricepulse_test
```

## Layout

`src/`: `store.js` (HTTP JSON client), `scraper.js` (browser flow), `parse.js` (price/stock parsing), `layout.js`
(manifest and page-structure checks), `retry.js` (retry policy and outcomes), `faults.js` (opt-in fault injection
for demos), `schedule.js` (slot alignment), `runner.js` (one scrape run), `db.js` (SQL), `migrate.js`, `cli.js`.
Settings and their environment variables: `src/config.js`, `.env.example`. Store behavior: `docs/store-notes.md`.
Render measurements: `docs/deployment-notes.md`.
