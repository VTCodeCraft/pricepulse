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

## Implications

- Run one browser at a time, sequentially, and close it after each run.
- Size timeouts for 0.15 CPU: allow ≥ 45 s for the price to settle and ≥ 90 s per attempt.
- A cold start (~52 s) is longer than a typical cron request timeout, so the scrape trigger must answer
  immediately and a pre-wake or keep-warm ping will likely be needed — decide in Phase 6 against the cron service's
  measured timeout.
- Supabase must be reached through its IPv4 pooler, not the IPv6-only direct host.
