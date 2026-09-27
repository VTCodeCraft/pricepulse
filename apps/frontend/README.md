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
  states, status badge.
- `src/lib/api/`: one Axios client (`client.ts`, turns every failure into an `ApiError` with the API's own code) and one
  module per backend area in use (`tracked.ts`, `runs.ts`, `catalog.ts`). Components never call Axios; they use the feature hooks.
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

## Where the dashboard numbers come from

| Figure | Source |
|---|---|
| Tracked products | `GET /api/tracked` |
| Successful scrapes, failed attempts (24 h) | Each tracked option's `GET /api/tracked/:id/attempts`, counted by outcome. Run counters are not used: a run cut off by a crash never writes them. |
| Average price change | Each option's latest versus previous observation, from `GET /api/tracked` |

A manual refresh (`POST /api/tracked/:id/scrape`) answers 202 at once; the app then polls that run (`GET /api/runs/:id`) until
it finishes and shows the real result. Nothing else polls. The full-run endpoint (`POST /api/scrape/run`) needs the cron
secret and is never called from the browser.
