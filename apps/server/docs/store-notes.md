# INE mock store notes

Target: <https://demo.inelabteamdev.com/>. Observations from 2026-09-26 (times UTC), made with curl / Node
`fetch` at ≤ 1 request/s and a throwaway Playwright 1.63 headless probe kept outside the repo.
"Not verified" marks things read in the store's JS bundle or inferred, but not seen live.

## 1. Store architecture

Observed:
- React SPA (bundle `/assets/index-GaW5Fnef.js`, unchanged 07:02 → 13:26), nginx/1.30.4 in front, API served by
  Express (`X-Powered-By: Express`, `Cache-Control: no-store`).
- Every non-API path returns 200 and the same 459-byte HTML shell with an empty `#root` — including
  `/item/99999` and `/robots.txt`. Page status never says whether a product exists.
- Routes: `/` (paged catalog) and `/item/:id`. No search box.

## 2. Catalog API — `GET /api/v2/listings?page=&limit=`

Observed:
- Body: `{ page, perPage, totalPages, count, results: [{ id, slug, name, brand, category, sku, description }] }`; no price/stock.
- `count` 960; IDs 2001–2960 (2000 and 2961 are 404).
- `limit`: default 20, max 60, `0`/`abc` → 20, `-5` → 1 per page.
- `page`: `0`/`abc` → 1; past the end returns the **last page again** (page 17 → page 16), never an empty page.
- Order is reshuffled on every request. One pass of 16 × 60 returned 619 unique products; two passes 844.
- `q`, `search`, `sort`, `order`, `seed` are ignored.

## 3. Product API — `GET /api/v2/items/:id`

Observed:
- Keys: `id, slug, name, brand, category, sku, description, specs, reviews, optionAxis, options`; no price/stock.
- `options`: 2–4 per product (19-product sample: 4 × two, 7 × three, 8 × four), ids always `o1…oN`.
- 404 `{"error":"not_found"}` for `0`, `-1`, `abc`, `2331.5`, `2000`, `2961`.
- `02331` returns product 2331 (leading zeros accepted).

## 4. Quote flow

Observed (29 checks on 9 products, plus one run with injected failures):
- The panel starts as "Price locked" with "Check today’s price" disabled; hovering over the panel for a moment
  enables it.
- A click is sometimes ignored: 23 checks needed 1 click, 5 needed 2, 1 needed 3.
- Each attempt calls `GET /api/v2/handshake`, `POST /api/v2/handshake`, then
  `GET /api/v2/items/{id}/quote?opt={optionId}` with a Bearer pass. Without a pass the quote is 401.
- Quote response `{ itemId, option, ver, blob }`: `itemId` and `option` are plain text; the price is inside the
  encrypted `blob` and only reaches us through the rendered page.
- On an HTTP error the page retries by itself, up to 6 attempts, each with a new handshake:
  "Retrying (attempt 2/6)… Store responded with “upstream 503”." then "Couldn’t load the price after 6 attempts."
- A network error ("Failed to fetch", no HTTP response) was **not** retried: "Couldn’t load the price after 1 attempts."
- End states: `.offer-ready` (footer "Loaded in N attempt(s)") or `.offer-failed`.
- Timing: each handshake/quote call 13–484 ms; click to last quote response median 3.4 s, max 9.7 s.
- A cookie dialog (`role=dialog`, `aria-label="Privacy preferences"`, buttons "Allow" / "Reject cookies")
  covered the page on 6 of 10 loads, appearing after the page loaded.

Not verified: the exact unlock rule (bundle: ≥ 8 moves and ≥ 600 ms dwell), the click odds (bundle: 17.5 %
ignored, 17.5 % delayed 900 ms), and the dialog odds (bundle: 75 %).

## 5. Option behavior

Observed:
- The page pre-selects a random option (default seen at positions 0, 1, 2 and 3).
- Chips are `.opt-chip` buttons with `aria-pressed` in a `role=group` named after the axis. Clicking the exact
  label always set `aria-pressed="true"` on it.
- In every successful check the pressed chip, the quote URL `opt`, and the quote body `option` all matched.
- Product 2948 showed stock 193 for three different options while prices differed.

Not verified: whether stock is per product or per option (one sample only).

## 6. Price extraction

Observed:
- The real price is the one element matching `${manifest.priceTag}.${manifest.classes.priceValue}` inside the
  ready panel: `data.fgy-x1` in revision 633001, `span.kjr-w7` in 633003. It also has a random `v…` class.
- Decoys in the same row: hidden `span.price-value`, hidden `span.amount[data-price]`, the struck-through MRP,
  sometimes "Member price ₹…" (5 of 24 quotes), and a "% saving" badge that changed on every check.
  Hidden decoys can be close to the real price (₹36,908 vs ₹36,312).
- Formats in 24 quotes: `₹90,313` × 18, full-width digits `₹５４,５７７` × 4,
  `₹90,313/- (incl. of all taxes)` × 1, `Rs.` + U+00A0 + `1,393.00` × 1 (`outerHTML` shows `&nbsp;`).
- "Refreshing prices" (5 of 24): the price is dimmed to opacity 0.45 and the number differs from the next confirmed
  check — ₹93,377 vs ₹90,313, ₹2,32,981 vs ₹2,11,444, ₹1,97,090 vs ₹1,71,438.
- Prices move over hours: product 2331 / o1 was ₹96,021 at 07:10 and ₹90,313 at 13:27.

Observed later (Phase 2, 22 probe runs): spaced `₹1 432`, euro `₹36.312,00`, and every character
separated by NBSP + zero-width space (shown as ␣: `₹␣1␣,␣4␣3␣2`).

Not verified: `priceCarrier: "split"` (one span per character) — present in the bundle, never seen.

Recon cross-check: during capture, the store's decoded quote was also read from React internals. It matched the
manifest-selected price element and stock pill in 24 of 24 checks, so the DOM plus the network responses are enough.
That read is not part of any fixture or scraper code.

## 7. Stock extraction

Observed:
- One `.${manifest.classes.stock}` element per ready panel (`hdq-x1`, later `rtz-w7`).
- Texts: `Available (112)`, `Last few: 141`, `Ready to ship · 74 available`, `Stock: 193 remaining`,
  `30 units available`, `Sold out`.
- CSS uppercases the pill, so Playwright `innerText` returns `AVAILABLE (142)`; `textContent` does not.
- Stock moves over hours: product 2001 / o2 was "Sold out" at 07:10 and 74 at 13:28.

## 8. Manifest / layout — `GET /api/v2/ui/manifest`

Observed:

| Field | 07:02 | 13:26 |
|---|---|---|
| revision / variant | 633001 / 1 | 633003 / 3 |
| validUntil | 07:43:38 | 15:09:15 |
| classes | `*-x1` (price `fgy-x1`) | `*-w7` (price `kjr-w7`) |
| priceTag | `data` | `span` |
| order | stock, seller, delivery, rating | rating, delivery, seller, stock |
| ratingAria | true | false |
| priceCarrier, sellerTitle | text, true | text, true |

- Same key set and value types in both; identical on repeated requests within a revision.
- The product page loads the manifest on every visit.

Not verified: how often revisions change (two seen, about 6 h apart), and any change beyond renamed
classes/tags/order — no incompatible change has been seen.

## 9. Errors and rate limits

Observed:

| What | When | Detail |
|---|---|---|
| Quote 500 / 503 `{"error":"upstream_error"}` | 13:26–13:45 | 6 of 32 quote calls; the page recovered every one |
| "Failed to fetch" | ~13:30 | 3 checks in a row on 2948 / o2; the next page load worked |
| 429 `{"error":"rate_limited","scope":"general","retryAfter":1}`, `Retry-After: 1` | 07:05 | after ~100 fast requests, then ~8 back-to-back ones |
| nginx 503 HTML page (not JSON) | 07:05 | continuing that burst |
| 20 requests at 1 req/s | 07:08 | all 200 |
| ~200 requests at ≤ 1 req/s | 13:26–13:45 | no 429 |

- No rate-limit headers on 200 responses. Slowest single response seen: 484 ms.

Not verified: the real rate-limit threshold and window, the cause of "Failed to fetch", and genuinely slow
responses (the assignment says they happen; none were seen yet).

## 10. Implications for the scraper

- Catalog and product details over plain HTTP JSON; Playwright only for the quote. Keep ≥ 1.1 s between API calls.
- Catalog sync: walk pages by `totalPages`, repeat until unique IDs = `count`, then fetch missing IDs directly.
  Search is ours. Store product IDs as integers.
- API errors: 404 JSON = not found; 5xx, 429 (honour `Retry-After`), timeouts and non-JSON bodies are retryable.
- Browser attempt: new context → close the cookie dialog with "Reject" whenever it appears → click the exact option
  label and check `aria-pressed` → hover until the button is enabled → click, and click again if the panel does not
  become `aria-busy` within ~2.5 s → wait (≥ 30 s) for `.offer-ready` or `.offer-failed`.
- Ground truth is the DOM after explicit waits plus the network: the last 200 quote response must match the
  product and option, the panel must not show "Refreshing prices", and the price/stock come from the elements the
  page's own manifest names, read with `textContent`, exactly one each. No React internals.
- `.offer-failed` means our own retry (the page does not retry network errors).
- A 5xx before the successful quote, or "Loaded in N attempts" with N > 1, means the outcome is `retried`.
- The price parser must handle `₹`, `Rs.`, U+00A0, full-width digits, the tax suffix, Indian grouping and `.00`,
  and reject anything it does not recognise.

## 11. Fixtures — `test/fixtures/`

Offer fixtures are `offers/<name>.html` (panel `outerHTML`) plus `offers/<name>.json` (product, option, state,
expected result, displayed text, decoys, quote responses as status/path/`itemId`/`option`, and the manifest the page
used). No headers, cookies or tokens. `test/fixtures.test.js` checks them. All use manifest revision 633003
(price `span.kjr-w7`, stock `.rtz-w7`) and were captured 13:27–13:35.

| Fixture | Product / option | Displayed | Expected |
|---|---|---|---|
| `ready-default-clean` | 2179 / o1 Standard | ₹36,312 · Ready to ship · 134 available | 36312, stock 134 |
| `ready-trailing-tax-suffix` | 2331 / o1 64 GB | ₹90,313/- (incl. of all taxes) · Last few: 141 | 90313, stock 141 (real 503 recovered in-page) |
| `ready-rs-decimal-sold-out` | 2852 / o1 Warm white | Rs. 1,393.00 · Sold out | 1393, stock 0 |
| `ready-member-price-decoy` | 2331 / o1 64 GB | ₹90,313 + Member price ₹1,52,672 | 90313, stock 141 |
| `ready-unicode-digits` | 2592 / o1 Starter | ₹５４,５７７ · Available (112) | 54577, stock 112 |
| `pending-refreshing` | 2331 / o1 64 GB | ₹93,377 (dimmed) | not stored; next check was 90313 |
| `state-locked` | 2179 / o1 Standard | Price locked | not stored |
| `state-failed-network` | 2948 / o2 Starter bundle | Couldn’t load… after 1 attempts / Failed to fetch | not stored (real failure) |
| `state-retrying-injected` | 2331 / o1 64 GB | Retrying (attempt 2/6)… | not stored (503 injected in the probe browser) |
| `state-failed-injected` | 2331 / o1 64 GB | Couldn’t load… after 6 attempts | not stored (503 injected in the probe browser) |

Raw API bodies in `store-api/`: `manifest-633001.json` (07:02), `manifest-633003.json` (13:26), `item-2331.json`,
`item-not-found-404.json`, `listings-page1-limit3.json`, `error-quote-upstream-503.json`, and
`error-rate-limited-429.json` + `error-nginx-503.html` (from the 07:05 burst).
