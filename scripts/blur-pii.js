// PII blur for docs screenshots — run via Playwright browser_evaluate before capture.
// Proven pattern from the 2026-06 docs sessions; reuse, don't rewrite per page.
(() => {
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
  // Blur table cells containing email addresses (customer rows in admin tables)
  document.querySelectorAll('td').forEach((td) => {
    if (EMAIL_RE.test(td.textContent || '')) td.style.filter = 'blur(6px)';
  });
  // Blur revenue tiles (anchored by the "REVENUE" label text)
  document.querySelectorAll('*').forEach((el) => {
    if (
      el.children.length === 0 &&
      /revenue/i.test(el.textContent || '') &&
      el.closest('[class*="tile"], [class*="card"], [class*="stat"]')
    ) {
      const tile = el.closest('[class*="tile"], [class*="card"], [class*="stat"]');
      if (tile) tile.style.filter = 'blur(10px)';
    }
  });
  // Dismiss HubSpot popups that ruin captures
  document.querySelectorAll('[class*="leadinModal"]').forEach((el) => el.remove());
  return 'blur applied';
})();
