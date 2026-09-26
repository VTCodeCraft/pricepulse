# @pricepulse/server

Express API + scrape runner + Playwright scraper. Deployed to Render (Docker, `apps/server/Dockerfile`).

This app is **independently runnable**: it has its own `pnpm-lock.yaml`, does not import any
workspace package, and does not need Turborepo.

```bash
cd apps/server
pnpm install --frozen-lockfile
pnpm test
```

Implementation starts in Phase 2 (Render Playwright proof). See the root README.
