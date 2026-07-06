# SCW Commerce Docs (GitBook)

- Structure: `SUMMARY.md` is the page index; pushing to main auto-syncs GitBook.
- Docs must match live code at `../magentoReplacement/scw-commerce` — code wins.
  When a doc claim and the code disagree, fix the doc.

## Capturing authenticated screenshots (hard-won; do NOT re-derive)

- ONLY the edmunds Playwright MCP works: headed browser, the user logs in, then
  navigate → blur → screenshot. Known-dead avenues — do not retry: Chrome-extension
  MCP (read-tier, no clicks), computer-use screenshot save_to_disk (no local file),
  macOS `screencapture` (permission-blocked), in-page capture libs (CSP).
- Save under the Playwright allowed root (`.playwright-mcp/`), then `cp` out.
- SHOT-LIST FIRST: before driving the browser, emit the full list (URL, filename,
  what to show, what to blur) and offer the user manual capture as a parallel lane.
- Reuse the PII-blur snippet in `scripts/blur-pii.js` (email-regex td cells →
  blur(6px), revenue tiles → blur(10px)); don't rewrite it per page.
- Never stage data mutations on prod to compose a screenshot; never accept
  placeholders — ask the user instead.
- Test credentials: ask the user; NEVER paste credentials into chat or commit them.
