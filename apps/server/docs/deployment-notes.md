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

## Rules that follow from these measurements

- **Memory is constrained (512 MB):** one browser at a time, scrapes run sequentially, every context closed in
  `finally`. The scraper defaults follow this (`src/config.js`).
- **Slow CPU (0.15):** timeouts are sized for Render, not for a laptop — 60 s for the price to settle,
  120 s per try (`SCRAPER_QUOTE_TIMEOUT_MS`, `SCRAPER_TRY_TIMEOUT_MS`).
- **Cold start ~52 s:** the scrape trigger must return `202` immediately and scrape in the background; whether a
  pre-wake ping is needed is decided in Phase 6 against the cron service's measured timeout.
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
