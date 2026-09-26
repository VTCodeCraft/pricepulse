# AI Log

Running record of how AI tools were used on PricePulse and every **real** mistake they made.
Entries are added when a mistake is discovered, with evidence. Nothing is back-filled or invented.
This file feeds the "What AI got wrong" section of `docs/DESIGN_NOTE.md`.

## AI usage

| Tool | Used for |
|---|---|
| Claude Code (Claude Opus 5.5, desktop app) | Reading the assignment PDF; inspecting the mock store (raw HTTP, JS bundle, API probing, throwaway Playwright probes); implementation plan; project scaffolding (Phase 0). |

Every AI-generated change is reviewed by me before it is committed. Later phases will add rows here.

## Mistakes

Template:

```
### N. <short title>
- When / tool:
- What the AI did or proposed:
- What was wrong:
- Evidence:
- Fix (commit):
- Lesson applied to the code:
```

### 1. Tried to load the price in a hidden browser tab
- **When / tool:** 2026-09-26, store inspection, Claude Code built-in browser pane.
- **What the AI did:** tried to unlock and load the product price by hovering and clicking in its built-in browser pane.
- **What was wrong:** the pane was not visible (`document.visibilityState === 'hidden'`), so the page's timers and `requestAnimationFrame` were throttled. The "Check today's price" button stayed disabled even though trusted `mousemove` events reached the price panel.
- **Evidence:** in-page check returned `hidden: true`; the panel stayed in `offer-locked` with the button disabled.
- **Fix:** re-ran the same flow in a real Playwright page (throwaway probe outside the repo); the price loaded and the quote network flow was observed.
- **Lesson applied:** the scraper always drives its own foreground/headless Playwright page. The store's attestation also samples animation-frame timings, so a background tab is not acceptable.

### 2. Clicked an option chip by screenshot coordinates
- **When / tool:** 2026-09-26, store inspection, Claude Code built-in browser pane.
- **What the AI did:** clicked the "64 GB" option using coordinates read from a screenshot.
- **What was wrong:** the screenshot frame (800 px wide) did not match the page's CSS viewport (692 px, devicePixelRatio 1.375), so the click missed and the store's random default option ("128 GB") stayed selected.
- **Evidence:** `aria-pressed` check after the click showed `128 GB: true`, `64 GB: false`.
- **Fix:** clicked the chip through its accessibility reference instead; `aria-pressed` then showed `64 GB: true`.
- **Lesson applied:** the scraper selects options with role/label locators (`getByRole('button', { name, exact: true })`) and asserts `aria-pressed="true"` before requesting a price.
