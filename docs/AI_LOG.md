# AI Log

How AI tools were used on PricePulse, and every real mistake they made. Entries are added when a mistake is
found, with evidence. This file feeds the "What AI got wrong" section of the design note.

## AI usage

| Tool | Used for |
|---|---|
| Claude Code (Claude Opus 5.5, desktop app) | Reading the assignment; inspecting the mock store (HTTP, JS bundle, API probing, throwaway Playwright probes); the implementation plan; repo scaffolding (Phase 0); fixtures, fixture tests and store notes (Phase 1). |

I review every AI-generated change before committing it.

## Mistakes

### 1. Loaded the price in a hidden browser tab (store inspection)
- **Mistake:** tried to unlock and load a price in Claude Code's built-in browser pane while the pane was hidden.
- **Evidence:** `document.visibilityState` was `hidden`; the panel stayed "Price locked" with the button disabled even though trusted `mousemove` events reached it.
- **Fix:** ran the same steps in a real Playwright page; the price loaded.
- **Lesson:** the scraper always drives its own foreground/headless Playwright page, never a background tab.

### 2. Clicked an option by screenshot coordinates (store inspection)
- **Mistake:** clicked "64 GB" using coordinates read from a screenshot.
- **Evidence:** the screenshot was 800 px wide but the page viewport was 692 CSS px (devicePixelRatio 1.375); afterwards `aria-pressed` was still true on the store's random default "128 GB".
- **Fix:** clicked through the element's accessibility reference; `aria-pressed` moved to "64 GB".
- **Lesson:** select options with role/label locators and check `aria-pressed="true"` before asking for a price.

### 3. Read stale React state as ground truth (Phase 1 probe)
- **Mistake:** the capture probe read the store's decoded quote from React internals and picked the stale copy of the component.
- **Evidence:** the first check on each product recorded `phase: "loading"` while the panel was already `offer-ready`.
- **Fix:** corrected the probe for the recon cross-check only; it then matched the DOM in 24 of 24 checks. Fixtures and tests no longer contain or depend on any React-internal data.
- **Lesson:** ground truth is the DOM after explicit waits plus the quote network response.

### 4. Secret guard too broad, then silently weakened (Phase 1 export)
- **Mistake:** the fixture export guard first matched the word "cookie" (rejecting the consent dialog's UI text), and the `sed` edit meant to fix it stripped the regex backslashes.
- **Evidence:** export error `secret-like content in consent-dialog`; the edited guard read `/bearers|…|"pass"s*:|R0VUfC/i`, which no longer matches `Bearer <token>`.
- **Fix:** rewrote it in an editor as `/bearer\s|authorization|set-cookie|"pass"\s*:|R0VUfC/i` and added the same scan to `apps/server/test/fixtures.test.js`.
- **Lesson:** re-read security checks after every edit; keep the scan in the test suite.

### 5. Compared displayed text with raw HTML (Phase 1 test)
- **Mistake:** the fixture test expected the displayed price text to appear verbatim in the saved `outerHTML`; the first fix then put an invisible U+00A0 character into the test source.
- **Evidence:** the test failed on the correct `Rs. 1,393.00` fixture because `outerHTML` writes U+00A0 as `&nbsp;`; `od -c` showed bytes `302 240` in the source.
- **Fix:** decode `&nbsp;` before comparing, written as `String.fromCharCode(0xa0)`.
- **Lesson:** the price parser must treat U+00A0 as a space and work on text content, not serialized HTML.
