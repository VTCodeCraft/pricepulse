# PricePulse

Product price tracker for INE's hosted mock store (<https://demo.inelabteamdev.com/>).
Search a product by name, pick an option, and PricePulse scrapes its price and stock on a schedule,
keeping an honest history of every scrape attempt.

> Status: **Phase 0 — repository scaffolding.** Full documentation (setup, environment variables,
> scraping schedule, deployment, API, CSV export) is written as the features land.

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
