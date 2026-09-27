# @pricepulse/frontend

The PricePulse dashboard: React 19, TypeScript, Vite, MUI. It talks only to the PricePulse API (`apps/server`).
Deployed to Vercel with root directory `apps/frontend`.

This app is independently installable: it has its own `pnpm-lock.yaml` and imports no workspace package.

```bash
cd apps/frontend
cp .env.example .env        # point VITE_API_URL at the API
pnpm install --frozen-lockfile
pnpm dev                    # http://localhost:5173 (the API allows this origin by default)
pnpm typecheck && pnpm lint && pnpm build
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

`src/app/` (providers, router, 404), `src/components/layout/` (sidebar, header, shell),
`src/components/common/` (page header, loading, empty and error states, status badge), `src/features/<area>/pages/`
(one folder per section), `src/theme/theme.ts` (every colour token, light and dark), `src/lib/query/` (React Query).
Each page is loaded as its own chunk; libraries are split into `react`, `mui` and `vendor` chunks.
