# Deployment

| Part | Host | Source |
|---|---|---|
| API, scheduler, scraper | Render (Docker, root directory `apps/server`) | `https://pricepulse-bgxj.onrender.com` |
| Frontend | Vercel (root directory `apps/frontend`, `VITE_API_URL` set in the project) | `https://pricepulse-smoky.vercel.app` |
| Database | Supabase PostgreSQL (session pooler, verified TLS) | migrations run on every server start |
| Schedule | cron-job.org calls `POST /api/scrape/run` with `CRON_SECRET` | the server decides what is due |

Server details (memory, cold starts, the database connection) are in `apps/server/docs/deployment-notes.md`.

## Pipeline

```
push / pull request ──► CI (.github/workflows/ci.yml)
                         lint · typecheck · test (with PostgreSQL) · build · actionlint
push to main, CI passed ──► Deploy (.github/workflows/deploy.yml)
                              backend: Render deploy hook, pinned to the tested commit
                              smoke: GET /api/health and the live site
push to main ──► Vercel Git integration builds and deploys apps/frontend
```

- `deploy.yml` starts from `workflow_run` of CI and requires the CI run to be a successful **push to main**. Pull
  requests and other branches never deploy through it.
- It deploys `workflow_run.head_sha`, the commit CI tested, not whatever `main` points to later.
- One deployment at a time (`concurrency: deploy-production`).
- The frontend is built and deployed by Vercel from `apps/frontend` on every push to `main` (preview deployments
  for other branches).

## Secrets

| Secret (GitHub → Settings → Environments → production) | Where to get it |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Render → service → Settings → Deploy Hook |

It is passed to the step through `env` and never echoed; GitHub masks it in logs. Without it, the backend job logs a
notice and Render's own auto-deploy is used. With it, set Render's Auto-Deploy to **Off** so each commit is deployed
once, after CI.
