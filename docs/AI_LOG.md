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

### 6. Created and pushed the repo on the wrong GitHub account (Phase 0)
- **Mistake:** created the GitHub repo with the `gh` CLI without checking which account it was logged into; it was my company account (`Vishesh-Gudz`), not my personal one.
- **Evidence:** a later plain `git push` failed with `Permission to Vishesh-Gudz/pricepulse.git denied to VTCodeCraft`, which showed two different accounts were in use.
- **Fix:** created `VTCodeCraft/pricepulse`, pointed `origin` at it, and pushed the same history there.
- **Lesson:** confirm the target account/owner before any action that publishes code.

### 7. Invisible characters in a regex, again (Phase 2 probe)
- **Mistake:** the probe's price parser was written with a literal U+00A0 and U+200B inside a regex character class, repeating mistake 5.
- **Evidence:** a code-point scan of `src/debug/probe.js` found 1 NBSP and 1 zero-width space; `od -c` showed the raw bytes in the regex.
- **Fix:** replaced them with a named `ZERO_WIDTH_SPACE = String.fromCharCode(0x200b)` constant and `\s` (which already covers U+00A0); re-scanned to 0.
- **Lesson:** never type invisible characters into source; use named constants and scan new files for them.

### 8. Test harness sent a malformed secret header (Phase 2 gate run)
- **Mistake:** the script that called the local probe read the secret with `grep DEBUG_PROBE_SECRET .env`, which also matched a comment line, so the header contained a newline.
- **Evidence:** all 9 first-run probes returned empty bodies; a verbose retry showed `HTTP 400` in 0.02 s and a 116-character "secret" instead of 32.
- **Fix:** match only `^DEBUG_PROBE_SECRET=` and take everything after the first `=`; the rerun passed 9/9.
- **Lesson:** check a harness's inputs before trusting its results; an instant 400 means the request never reached the code under test.

### 9. Page-structure check rejected a normal loading state (Phase 3)
- **Mistake:** `checkDomContract` required a price button inside the panel in every state.
- **Evidence:** the test on the real `state-retrying-injected` fixture failed: while the store is retrying, the panel shows a spinner and has no button. In production this would have reported `layout_changed` mid-retry.
- **Fix:** require the button only in the locked, ready and failed states.
- **Lesson:** check structural rules against every captured state, not only the happy path.

### 10. Browser launch failures were unreadable and mislabelled (Phase 3)
- **Mistake:** a failed Chromium launch surfaced as `unexpected` with Playwright's full multi-line call log in every log line.
- **Evidence:** the first headed run on Windows printed three pages of launch arguments for `spawn UNKNOWN`.
- **Fix:** `launchBrowser` throws `browser_launch_failed` with the first line only; all Playwright errors are cut to their first line.
- **Lesson:** error messages are part of the product: one line, a clear code.
