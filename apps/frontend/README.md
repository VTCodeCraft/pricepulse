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
- `src/components/layout/`: sidebar, header, shell, command palette. `src/components/common/`: page header, section,
  stat, loading, empty and error states, status badge, label/value list, time-range toggle.
- `src/lib/api/`: one Axios client (`client.ts`, turns every failure into an `ApiError` with the API's own code) and one
  module per backend area in use (`tracked.ts`, `runs.ts`, `catalog.ts`, `export.ts`, `system.ts`). Components never
  call Axios; they use the feature hooks.
- `src/lib/query/`: the React Query client and every query key. `src/lib/utils/`: formatting (INR, percentages, times)
  and values derived from observations (stock state, price change).
- `src/types/`: the API's response shapes, taken from `apps/server/src/utils/serializers.js`.
- `src/features/<area>/`: pages, components and hooks per section. `src/theme/theme.ts`: every colour token.
- Tests: pure logic in Node; component tests (`*.test.tsx`, jsdom + Testing Library, `src/test/renderWithProviders.tsx`)
  mock the API modules only.

Each page is loaded as its own chunk. Every page needs the `react`, `query` and `mui` chunks; the `data-grid` chunk
and the charts load only with the pages that use them, and the command palette on first use.

## Design

`src/theme/theme.ts` is the single source of truth: palettes, typography, radii, the mono and eyebrow styles, motion
timing, and the MUI/DataGrid component overrides. Components read colours through `theme.vars.palette`.

- Colour: black, white and one accent, orange `#EE5A10` (dark theme `#FF6A1F`), in the range of INE's brand orange;
  neutral grays; semantic green/amber/red only for states. Light: `#FAFAFA` page, white surfaces, `#111` ink. Dark:
  `#070707` page, `#0F0F0F` surfaces. Primary buttons are ink and turn orange on hover.
- Type: Geist for the interface, Geist Mono for ids, timestamps, SKUs, labels and shortcuts.
- Structure: hairline rules and whitespace instead of cards (`Section`), a metrics strip on the dashboard, a hairline
  catalogue grid on All Products, a compact list for tracked products on phones.
- Brand: `components/common/BrandMark.tsx`, an original geometric P with an orange square (the latest data point); the
  same drawing is `public/favicon.svg`.
- Motion: one easing (`cubic-bezier(0.16, 1, 0.3, 1)`); page fade, sliding nav marker, theme icon swap. Changing the
  theme reveals the new one as a circle from the control (View Transitions API, `theme/useThemeToggle.ts`); instant
  without the API or with reduced motion.

## Products

- `/products` (All Products): every product of the demo store, 24 per page from the server
  (`GET /api/catalog/products?q=&page=`), searchable by name (300 ms debounce; every word must appear). The search and
  page are kept in the URL. Each card shows the store id, brand, category, SKU, the option count once known, and which
  options are tracked (from `GET /api/tracked`); Track Product opens the tracking dialog at that product's options.
- `/tracked` (Tracked Products): catalogue search (`GET /api/catalog/search`) above the table of tracked options.
- `/products/:storeProductId?option=oN`: one store product, live from the store (`GET /api/catalog/products/:id`), with
  its options and which of them are tracked (from `GET /api/tracked`). If the store does not answer, a tracked product
  falls back to the details saved when it was tracked.
- Tracking (dialog, product page or All Products): the user ticks one or more options explicitly, or "Select all
  untracked"; nothing is pre-selected and an option that is already tracked cannot be picked again. One
  `POST /api/tracked` (`optionIds`) answers at once and starts one first-scrape run for the new options; the list
  refreshes again when that run finishes.

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
- Export CSV (on the dashboard and here) downloads `GET /api/export.csv`, which the server generates (every finished
  attempt). The API does not expose `Content-Disposition` to other origins, so the file name follows the server's
  pattern with the browser's time.

## Analytics

`/analytics` is derived in the browser from data other pages already load; there is no analytics endpoint. Sources: the
active options (`GET /api/tracked`), every option's scrape log (the same cached `GET /api/tracked/:id/attempts?limit=500`
queries as Scrape Logs, untracked options included) and, for the selected option only, its price history. One time
range (24H / 7D / 30D / 90D / All, exact hours back from when the page opened) applies to every section except stock.

- Price movement: latest against previous observation (amount and percentage), and lowest, highest and average over the
  range, with the history chart shared with the product page.
- Scrape reliability: successful (success or retried, as on the dashboard), retried, failed and the share of finished
  attempts that returned a valid price. Outcomes are the backend's; run counters are not used.
- Scrapes over time: finished attempts per local hour (up to two days of data) or per local day, by outcome, from the
  first attempt in the range up to now.
- Stock availability: in stock, out of stock and not yet scraped, from each option's latest observation; the store gives
  no low-stock signal, so there is none.
- Product comparison: each option's price, change, attempt counts in the range and stock.

## Settings and command palette

- Appearance (light, dark, system) uses MUI's colour-scheme state, the same one the header toggle uses; the choice is
  kept in this browser.
- System asks `GET /api/health`: connected, unavailable or checking; database state; server uptime; the app version
  (from `package.json`, plus the commit when Vercel provides `VITE_VERCEL_GIT_COMMIT_SHA`).
- Scraping shows what the API reports (active options, their intervals, the next scheduled scrape, the last run) and
  the store page structure from `GET /api/layout` (unchanged / changed, when it was checked, the layout revision).
  An option's interval is changed on its product page (Scrape interval selector, `PATCH /api/tracked/:id`).
- Alerts lists `GET /api/alerts`: price drops, returns to stock and page-structure changes, with old and new values and
  a link to the option; "Mark as read" acknowledges them. The dashboard shows the latest price drops and restocks.
- Ctrl+K (⌘K) or the header's Commands button opens a palette: the pages, Track Product (the existing dialog), toggle
  theme and Export CSV. It has no "run a full scrape": that endpoint needs the cron secret.

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
