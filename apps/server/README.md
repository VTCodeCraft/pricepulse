# @pricepulse/server

Express API, scrape runner and Playwright scraper. Deployed to Render with `apps/server/Dockerfile`.

This app is independently runnable: it has its own `pnpm-lock.yaml`, imports no workspace package, and does not
need Turborepo.

```bash
cd apps/server
pnpm install --frozen-lockfile
pnpm test
pnpm scrape -- --product 2179 --option o1            # headless
pnpm scrape -- --product 2179 --option o1 --headed   # watch it in a browser window
```

Scraper modules (`src/`): `store.js` (HTTP JSON client), `scraper.js` (browser flow), `parse.js` (price/stock
parsing), `layout.js` (manifest and page-structure checks), `retry.js` (retry policy and outcomes), `faults.js`
(opt-in fault injection for demos), `cli.js`. Settings and their environment variables: `src/config.js`,
`.env.example`. Store behavior: `docs/store-notes.md`. Render measurements: `docs/deployment-notes.md`.
