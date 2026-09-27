# PricePulse

Product price tracker for INE's hosted mock store (<https://demo.inelabteamdev.com/>).
Search a product by name, pick an option, and PricePulse scrapes its price and stock on a schedule,
keeping an honest history of every scrape attempt.

Live: frontend <https://pricepulse-smoky.vercel.app>, API <https://pricepulse-bgxj.onrender.com/api/health>.
Server setup, environment variables, schedule and API: [`apps/server/README.md`](apps/server/README.md). Frontend:
[`apps/frontend/README.md`](apps/frontend/README.md). Deployment and CI/CD: [`docs/deployment.md`](docs/deployment.md).

## Bonus features

| Bonus | What it does | Where |
|---|---|---|
| Price-drop alerts | A validated price lower than the option's previous validated one raises a persisted alert (product, option, both prices, change); failed attempts are never compared | `apps/server/src/services/alerts.service.js`; Settings → Alerts, dashboard |
| Back-in-stock alerts | Previous validated stock 0 and new stock above 0 raises an alert | same service and views |
| Dashboard | Metrics strip, tracked options, latest price drops and restocks, biggest price moves, recent scrape activity, all from API data | `apps/frontend/src/features/dashboard` |
| Page-structure change detection | A fingerprint of the price panel's structure that ignores prices, stock text, formats and CSS class rotation; a change raises an alert and shows in Settings → Scraping | `pageStructure` in `apps/server/src/scraper/layout.js`, migration `003` |
| Configurable scrape frequency | Per option: 1, 2 (default), 4, 6, 12 or 24 hours, UTC-aligned, set on the product page | `apps/server/src/scheduler`, `PATCH /api/tracked/:id` |
| Several options per product in one run | A run groups options by product: one lookup and one browser session per product, one attempt per option with its own retries and checks | `apps/server/src/scheduler/runner.js` |
| GitHub Actions CI/CD | CI: lint, typecheck, tests with PostgreSQL, build, actionlint. Deploy: after CI passes on `main`, the tested commit goes to Render and Vercel | `.github/workflows/`, `docs/deployment.md` |

## Repository layout

```
apps/
  frontend/   React + Vite dashboard        → Vercel (root directory: apps/frontend)
  server/     Express API + scraper + runner → Render (Docker, apps/server/Dockerfile)
packages/
  shared/     dependency-free contract constants
docs/         design note, AI log, store notes
```

## Development

Requires Node 22.12+ and pnpm 11 (`corepack enable`).

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

Each app keeps its own `pnpm-lock.yaml` (`sharedWorkspaceLockfile: false`), so `apps/server` and
`apps/frontend` can also be installed and run on their own without Turborepo.
