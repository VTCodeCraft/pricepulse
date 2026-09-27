# Server deployment notes

## Render (measured 2026-09-26, Phase 2 gate)

Service: `https://pricepulse-bgxj.onrender.com` — Docker, root directory `apps/server`, Singapore, Free plan,
health check `/api/health`, auto-deploy from `main`.

| Item | Value |
|---|---|
| Base image | `mcr.microsoft.com/playwright:v1.63.0-noble` (matches npm `playwright@1.63.0`) |
| Runtime in image | Node v24.20.0, Chromium 153.0.8010.12 |
| Memory limit (cgroup `memory.max`) | 512 MB |
| CPU quota (cgroup `cpu.max`) | `15000 100000` → 0.15 CPU; 1 CPU visible |
| Outbound IPv6 | not available |
| Outbound to the mock store | works (HTTPS, no blocking seen) |
| Idle spin-down | yes: after 18 min idle, first request took 89 s (~52 s spin-up + 37 s probe) |

Memory during 9 warm probes: container peak 454–494 MB (includes reclaimable file cache; 354 MB peak after a
fresh start), Node RSS ≤ 130 MB. No crash or OOM. Every run closed the browser with 0 leftover processes.

## Phase 2 gate results

Same probe (real product page in Playwright; cookie dialog dismissed; exact option clicked and checked via
`aria-pressed`; unlock + click until the page starts its handshake; pending prices re-checked; last quote response
checked for product/option; manifest-named price and stock read with `textContent`).

| Product / option | Local (Windows) | Render |
|---|---|---|
| 2179 / o1 | 3/3 pass — ₹36,312, stock 134 | 3/3 pass — ₹36,312, stock 134 |
| 2852 / o1 | 3/3 pass — ₹1,432, stock 77 | 3/3 pass — ₹1,432, stock 77 |
| 2331 / o1 | 3/3 pass — ₹73,515 / 159, then a real store change to ₹79,613 / sold out | 3/3 pass — ₹1,01,669, stock 36 |
| Duration per probe | 4.7–10.3 s (median 6.8 s) | 11.9–41.6 s (median 17.2 s) |
| Cold start (2179 / o1) | — | pass, 89 s total |

All runs: handshakes 200, zero 401/403, final quote matched the requested product and option, no pending value
returned (pending seen 5 times and re-checked), real quote 500s recovered by the page (3 times).

## Supabase (verified 2026-09-26, Phase 5)

- Project region ap-southeast-2 (Sydney); Render runs in Singapore, so every query crosses that link.
- Connection: the **Session pooler** URI (IPv4, port 5432). The direct host is IPv6-only and unreachable from Render.
- The pooler certificate chain ends in **Supabase Root 2021 CA** (self-signed, valid to 2031-04-26,
  SHA-256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`).
  Node does not trust it by default: plain `sslmode=require` fails with `SELF_SIGNED_CERT_IN_CHAIN`.
- The pooler URI on its own connected **without TLS** until "Enforce SSL on incoming connections" was switched on;
  plain-text connections are now refused (`ESSLREQUIRED`).
- Production `DATABASE_URL` = pooler URI + `?sslmode=verify-full&sslrootcert=certs/supabase-prod-ca-2021.crt`.
  `certs/supabase-prod-ca-2021.crt` is the CA downloaded from the Supabase dashboard; its fingerprint matches the
  root the server actually presents. With it the connection is encrypted and the certificate and host name are
  verified.
- Migrations `001_init.sql` and `002_catalog_synced_at_nullable.sql` are applied; the server re-checks on every start.

## Cold starts (measured 2026-09-26 and 27, Phase 6)

Each sample was taken after at least 15 minutes without inbound requests, with a client-side time limit and
curl's default `Accept: */*`. The database was read directly, so checking a result did not wake the service.

| Sample | Client limit | Client result | Instance | Run created |
|---|---|---|---|---|
| C1 18:59:58 UTC | 30 s | `202` after 13.9 s | new pod, uptime 12 s | run 4 (`cron`, nothing due) |
| C2 19:17:30 UTC, `force` | 30 s | `202` after 14.4 s | new pod, uptime 12 s | run 5: 3 of 3 scraped in the background, 78 s |
| C3 19:35:31 UTC | 5 s | aborted after 5.0 s | started 2.6 s after the request | **none** |

- Cold starts vary: 13.9 s and 14.4 s above, later 44 s, 53 s and 43.5 s. cron-job.org closes a request after 30
  seconds on the free plan (`Failed (timeout)`), so a call that meets a sleeping instance can time out.
- A request abandoned before the instance is ready still starts the instance, but the request itself is dropped:
  no run is created.
- Work started by a `202` finishes after the response, with no request open (run 5).

## Render's loading page

While a free instance is asleep or starting, Render answers any request whose `Accept` header includes `text/html`
with its own "Application loading" page instead of passing it on: HTTP 503, `text/html`, 258,535 bytes (its fonts are
inlined as base64). The request never reaches Express, so the app logs nothing and no run is created. Reproduced on
2026-09-27 at 06:38 UTC with five simultaneous requests to a sleeping instance: the four with `text/html` in `Accept`
(GET and POST; a browser User-Agent and `Mozilla/4.0 (compatible)`, the one in cron-job.org's published sample
configuration) got the page within 2 s; the one with `Accept: application/json` was held for 43.5 s and then answered
by the app (200, 429 bytes). Requests with `Accept: */*` or `application/json` were always held and answered by the
app.

cron-job.org reads at most 64 KB of a response (headers plus body) and records anything larger as
`Failed (output too large)`.

## cron-job.org jobs (Phase 6)

| Job | Request | Headers | Schedule (UTC) |
|---|---|---|---|
| PricePulse scrape | `POST /api/scrape/run` | `Authorization: Bearer <CRON_SECRET>`, `Accept: application/json` | `0 * * * *` |
| PricePulse wake | `GET /api/health` | `Accept: application/json` | `50,55 * * * *` |

- `Accept: application/json` keeps Render from answering with the loading page.
- At :50 the service has normally been idle since the :00 call and is asleep. A held request starts the instance
  even if the caller gives up (sample C3), so the :55 call and the :00 scrape should find it running. When a cold start
  takes longer than 30 s, cron-job.org records the :50 call as a timeout; the :55 success keeps the wake job from
  failing more than 25 times in a row, after which cron-job.org disables a job.
- cron-job.org's calls arrive 20–85 s after the scheduled minute. A late call still finds its slot due; the 5-minute
  tolerance only matters for a call that arrives early.

History (UTC):

- 2026-09-26 20:01 to 2026-09-27 06:01, without the `Accept` header: every call that met a sleeping or starting
  instance failed with "output too large". No run was created between 21:01 and 06:44, so the 22:00, 00:00, 02:00,
  04:00 and 06:00 slots were missed.
- In between, with the instance awake: after the scrape job's method and `Authorization` header were corrected,
  cron-job.org's calls created run 6 (20:40, the 3 options due since 20:00) and run 16 (21:01, nothing due).
- 2026-09-27 06:44, with `Accept: application/json`: a cron-job.org test run created run 17, which scraped all 10
  options (7 success, 3 retried). The 07:00 call created run 18 at 07:01:19 (nothing due; next slot 08:00).

## Tracked in production

10 options, every 120 minutes, all added through `POST /api/tracked` on 2026-09-26: 2179/o2, 2852/o2, 2331/o3,
then one product per remaining store category (the lowest ID in each), with options o1–o4 mixed: 2001/o2, 2025/o1,
2065/o3, 2073/o4, 2041/o3, 2033/o2, 2057/o1. A `force` run over all 10 (run 15, 20:49–20:52 UTC) got a price and
stock for each (8 success, 2 retried), each checked against the page text, the quote's product and option, and
the decoy prices.

## Rules that follow from these measurements

- **Memory is constrained (512 MB):** one browser at a time, scrapes run sequentially, every context closed in
  `finally`. The scraper defaults follow this (`src/config.js`).
- **Slow CPU (0.15):** timeouts are sized for Render, not for a laptop — 60 s for the price to settle,
  120 s per try (`SCRAPER_QUOTE_TIMEOUT_MS`, `SCRAPER_TRY_TIMEOUT_MS`).
- **Cold start 14–54 s:** the scrape trigger returns `202` immediately and scrapes in the background; cron-job.org
  sends `Accept: application/json`, and the wake call at minute 50 starts the instance before minute 55 and 0.
- **Outbound is IPv4-only:** Supabase must be reached through its IPv4 pooler, not the IPv6-only direct host.

## Phase 3 scraper in the production image

The Phase 3 scraper (`src/cli.js`) was run inside this Dockerfile's image on the dev machine with Render's measured
limits (`docker run --memory=512m --memory-swap=512m --cpus=0.15`, `NODE_ENV=production`):
2179 / o1, 2852 / o1 and 2331 / o1 all succeeded on the first try in 18–37 s, and `--inject` was refused.

## Consistency notes

- **Node versions differ:** local development uses Node 22.23; the Playwright image runs Node 24.20. Both satisfy
  `engines: >=22.12` and every check passed on both, but a Node-24-only difference would first show up on Render.
- **Local headed runs:** on the development Windows machine the bundled Chromium binary is blocked from starting
  (`spawn UNKNOWN`, "Permission denied"; the headless shell is not blocked). Headed runs there use the installed
  Chrome via `SCRAPER_BROWSER_CHANNEL=chrome`. Production leaves that variable unset.
