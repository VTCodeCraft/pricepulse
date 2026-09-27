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
                              frontend: Vercel CLI build + deploy --prod of the tested commit
                              smoke: GET /api/health on production
```

- `deploy.yml` starts from `workflow_run` of CI, and each job requires the CI run to be a successful **push to
  main**. Pull requests and other branches never deploy.
- It deploys `workflow_run.head_sha`, the commit CI tested, not whatever `main` points to later.
- One deployment at a time (`concurrency: deploy-production`).

## Secrets

Set these as secrets of the `production` environment (GitHub → Settings → Environments → production). They are
passed to steps through `env` and never echoed; GitHub masks them in logs.

| Secret | Where to get it |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Render → service → Settings → Deploy Hook |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link` in `apps/frontend` (not committed) |

## One deployment path per target

Render and Vercel also deploy on their own when `main` changes. Until a target's secrets are set, its deploy job
only logs a notice and the platform's auto-deploy stays in charge, so nothing breaks. Once the secrets are set,
switch the platform's auto-deploy off so each commit is deployed once, after CI:

- Render: service → Settings → Auto-Deploy → **Off** (the workflow's deploy hook takes over).
- Vercel: add `"git": { "deploymentEnabled": { "main": false } }` to `apps/frontend/vercel.json`, so pushes to
  `main` no longer deploy through the Git integration (preview deployments for other branches keep working).

Do these after the secrets are in place, not before: with auto-deploy off and no secrets, nothing would deploy.
