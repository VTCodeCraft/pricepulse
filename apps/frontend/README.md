# @pricepulse/frontend

The PricePulse dashboard: React 19, TypeScript, Vite, MUI. It talks only to the PricePulse API (`apps/server`).
Deployed to Vercel with root directory `apps/frontend`.

This app is independently installable: it has its own `pnpm-lock.yaml` and imports no workspace package.

```bash
cd apps/frontend
cp .env.example .env        # point VITE_API_URL at the API
pnpm install --frozen-lockfile
pnpm dev                    # http://localhost:5173 (the API allows this origin by default)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Environment

| Variable | Example | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` | Base URL of the API, including `/api`. In production, the Render service URL. |

The API only answers browsers from origins listed in its `CORS_ORIGINS`, so the Vercel URL has to be added there.

## Vercel

Root directory `apps/frontend`, framework preset Vite, build command `pnpm build`, output `dist`.
`vercel.json` sends every path to `index.html` so client-side routes such as `/products/3` load directly.

## Layout

- `src/app/`: providers, router, 404.
- `src/components/layout/`: sidebar, header, shell. `src/components/common/`: page header, loading, empty and error
  states, status badge, label/value list, time-range toggle.
- `src/lib/api/`: one Axios client (`client.ts`, turns every failure into an `ApiError` with the API's own code) and one
  module per backend area in use (`tracked.ts`, `runs.ts`, `catalog.ts`, `export.ts`). Components never call Axios;
  they use the feature hooks.
- `src/lib/query/`: the React Query client and every query key. `src/lib/utils/`: formatting (INR, percentages, times)
  and values derived from observations (stock state, price change).
- `src/types/`: the API's response shapes, taken from `apps/server/src/utils/serializers.js`.
- `src/features/<area>/`: pages, components and hooks per section. `src/theme/theme.ts`: every colour token.

Each page is loaded as its own chunk. Every page needs the `react` and `mui` chunks; the `data-grid` chunk loads only
with the pages that show a table.

## Products

- `/products`: search the store catalogue (`GET /api/catalog/search`, 300 ms debounce, 2–100 characters, every word must
  appear in the name) above the table of tracked options. A result opens its product page.
- `/products/:storeProductId?option=oN`: one store product, live from the store (`GET /api/catalog/products/:id`), with
  its options and which of them are tracked (from `GET /api/tracked`). If the store does not answer, a tracked product
  falls back to the details saved when it was tracked.
- Tracking (dialog or product page): the user picks one option explicitly; nothing is pre-selected and an option that is
  already tracked cannot be picked again. `POST /api/tracked` answers at once and starts the first scrape in the
  background; the list refreshes again when that run finishes.

## Price history

- A tracked option's product page shows its history from `GET /api/tracked/:id/history?limit=1000`: validated
  observations only (success and retried). The endpoint takes no dates and 1000 is its maximum, so one request is made
  and the 24H / 7D / 30D / 90D / All ranges are applied in the browser, as exact hours back from when the page opened,
  compared as UTC instants. Labels use the browser's time zone.
- Lowest, highest, average (mean of the observed prices) and change (first to last observation of the range) come
  only from those observations; with fewer than two the change reads "Needs two scrapes". If the response is full, a
  range reaching back past its oldest observation says so.
- Below it, the option's scrape history: every attempt, failed ones included.

## Scrape Logs

- `/logs` lists every attempt of every option, untracked ones included. The API has no log across options, so the page
  loads `GET /api/tracked?includeInactive=true` and each option's `GET /api/tracked/:id/attempts?limit=500` once (no
  polling) and merges them. The product, outcome, time-range and text filters run in the browser.
  `/logs?tracked=<id>` opens it filtered to one option.
- Outcomes are the backend's. `retried` also covers a page that needed the store's own retry or a price re-check within
  a single try, so it is not derived from the number of tries. Failed and running attempts show no price or stock.
- A row (click or Enter) opens the attempt: start and finish times (local and UTC), each try, the error code and message
  as recorded, and its run (`GET /api/runs/:id`). The run's outcome counts come from its attempts, because an abandoned
  run never writes its counters.
- Export CSV downloads `GET /api/export.csv`, which the server generates (every finished attempt). The API does not
  expose `Content-Disposition` to other origins, so the file name follows the server's pattern with the browser's time.

## Where the dashboard numbers come from

| Figure | Source |
|---|---|
| Tracked products | `GET /api/tracked` |
| Successful scrapes, failed attempts (24 h) | Each tracked option's `GET /api/tracked/:id/attempts`, counted by outcome. Run counters are not used: a run cut off by a crash never writes them. |
| Average price change | Each option's latest versus previous observation, from `GET /api/tracked` |

A manual refresh (`POST /api/tracked/:id/scrape`) answers 202 at once; the app then polls that run (`GET /api/runs/:id`) until
it finishes and shows the real result, then refetches the tracked lists and the history and scrape log on screen (all
under the `tracked` query keys). Nothing else polls. The full-run endpoint (`POST /api/scrape/run`) needs the cron
secret and is never called from the browser.
