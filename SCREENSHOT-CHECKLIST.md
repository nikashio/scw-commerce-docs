# Screenshot Capture Checklist

Working list of every screenshot the docs still need. Not a published page (intentionally absent from `_sidebar.md`).

**How to use:** capture each screenshot, save it to `images/<filename>` using the exact filename below, then replace the matching `> [SCREENSHOT: …]` marker in the doc with `![<caption>](images/<filename>)`.

**Totals:** 18 wired-but-uncaptured · 19 unnamed markers · 4 wrong/duplicate re-shoots · 1 orphan to resolve. Several can be satisfied by reusing one capture (noted inline), so the real shooting list is smaller.

---

## ① Markers with a filename already assigned — file is missing (18)

Drop the PNG at the listed path and the marker is ready to convert to an embed.

- [ ] **credit-terms.md:26** — `images/hubspot-contact-credit-terms.png` — HubSpot Contact property panel showing **Approved for Credit Terms (Yes)** and **Credit Limit**.
- [ ] **credit-terms.md:73** — `images/checkout-payment-methods-not-approved.png` — Checkout payment section showing only **three** options (Credit Card, Check/Money Order, ACH/Wire) — **no Credit Terms option**.
- [ ] **checkout-payment-methods.md:43** — `images/checkout-credit-card-form.png` — Credit-card entry form with Card Number, MM/YY, CVV and the encrypted-card security notice.
- [ ] **checkout-payment-methods.md:92** — `images/checkout-purchase-order-form.png` — Credit Terms form (formerly labeled Purchase Order) with the PO Number field and NET30 note.
- [ ] **checkout-payment-methods.md:132** — `images/checkout-check-instructions.png` — Check/Money Order checkout instructions: payee, Asheville NC mailing address, 14-day auto-cancel warning.
- [ ] **checkout-payment-methods.md:145** — `images/checkout-check-instruction-email.png` — Check payment instruction **email**: payee, Asheville NC address, memo instruction, 14-day cancellation warning.
- [ ] **checkout-payment-methods.md:170** — `images/checkout-ach-wire-instructions.png` — ACH/Wire checkout instructions: bank details emailed after order, ships only after funds verified.
- [ ] **checkout-payment-methods.md:183** — `images/checkout-wire-instruction-email.png` — Wire instruction **email** with bank details table (bank name, routing #, account #, account name).
- [ ] **checkout-payment-methods.md:267** — `images/checkout-address-suggestion.png` — Address-correction banner ("Did you mean …" + "Use this address") after a state/ZIP mismatch.
- [ ] **customer-accounts.md:18** — `images/customer-accounts-login-page.png` — Full `/login` page: two-column (Registered Customers form + Forgot Password; New Customers + Create Account).
- [ ] **customer-accounts.md:31** — `images/customer-accounts-login-migrated-message.png` — Login page after a migrated-user attempt: "Your account has been migrated…" info box + Reset Your Password link.
- [ ] **customer-accounts.md:47** — `images/customer-accounts-register-page.png` — `/register` page: Create New Customer Account form (Personal Information + Sign-in Information fieldsets).
- [ ] **tax-exemption-webhook.md:34** — `images/account-tax-exemption-form.png` — Customer Tax Exemption page: status card + "Request exemption" button + upload dialog (drop-zone, exemption-type select, states field).
- [ ] **tax-exemption-webhook.md:64** — `images/admin-tax-exemption-request-detail.png` — Admin Exemption Request **detail**: customer panel, uploaded docs list, "Review decision" card (type select, states, Approve, reject-reason box). *(Reuse for ③ `admin-tax-exemption-requests.png`.)*
- [ ] **make-automation-migration.md:121** — `images/make-webhook-payload-inspector.png` — Make.com data inspector showing the full SCW `order.created` payload (nested order object + compact top-level fields).
- [ ] **quote-builder.md:118** — `images/quote-builder-checkout-from-link.png` — Checkout opened from a HubSpot quote payment link: pre-loaded cart, pre-filled email, 3-column layout, locked prices.
- [ ] **refunds.md:119** — `images/refunds-customer-email.png` — Refund/credit-memo **email**: refund number, amount, refunded items, billing/shipping addresses, 5–10 business-days note.
- [ ] **refunds.md:184** — `images/hubspot-credit-memo-record.png` — HubSpot Credit Memo record: `ecm_` properties (ID, Status, Refund Type, Total Refund, Reason, Refund Date) + associations to Order, Invoice, Contact.

## ② Markers with no filename yet (19) — proposed filenames below

Filenames are suggestions; rename if you prefer. Several can reuse an existing image instead of a new capture.

- [ ] **admin-actions.md:22** — `images/hubspot-orders-pending-filtered.png` — Ecommerce Orders filtered by Status = Pending, Payment Method Type column visible.
- [ ] **admin-actions.md:49** — `images/hubspot-order-pending-detail.png` — Ecommerce Order detail in Pending status with payment-method info.
- [ ] **admin-actions.md:69** — `images/hubspot-order-source-id.png` — Ecommerce Order showing the `eo_source_id` property.
- [ ] **admin-actions.md:83** — `images/hubspot-order-processing.png` — Ecommerce Order after invoicing, status changed to Processing.
- [ ] **admin-actions.md:116** — `images/hubspot-contact-credit-approved.png` — Contact record: Approved for Credit Terms = Yes + Credit Limit. *(May reuse ①'s `hubspot-contact-credit-terms.png`.)*
- [ ] **order-lifecycle.md:143** — `images/hubspot-orders-list-statuses.png` — Ecommerce Orders list in HubSpot showing different statuses.
- [ ] **order-lifecycle.md:352** — `images/hubspot-order-action-card.png` — HubSpot order action card on an Ecommerce Order showing Invoice and Capture actions.
- [ ] **order-lifecycle.md:354** — **reuse** `images/hubspot-credit-memo-card.png` (already exists) — Refund Manager card on an Ecommerce Invoice.
- [ ] **order-lifecycle.md:379** — `images/hubspot-orders-list-status-column.png` — Ecommerce Orders list view with the Status column. *(Likely same shot as :143 — reuse if so.)*
- [ ] **order-lifecycle.md:386** — **reuse** `images/customer-accounts-order-history.png` (already exists) — Customer's My Orders page with statuses.
- [ ] **credit-terms.md:15** — `images/hubspot-contact-record.png` — HubSpot Contact record (overview).
- [ ] **credit-terms.md:67** — **reuse** `images/checkout-payment-methods-all-four.png` (already exists) — Checkout with all four payment methods.
- [ ] **customer-accounts.md:33** — `images/customer-accounts-reset-password.png` — Reset password page.
- [ ] **customer-accounts.md:142** — `images/customer-accounts-forgot-password.png` — Forgot password form.
- [ ] **customer-accounts.md:226** — `images/checkout-saved-address-cards.png` — Checkout showing saved address cards.
- [ ] **key-concepts.md:50** — `images/hubspot-contact-record.png` — Contact record showing key properties. *(Same shot as credit-terms.md:15 — reuse.)*
- [ ] **key-concepts.md:190** — `images/hubspot-order-associations-sidebar.png` — Ecommerce Order sidebar: Contact, Quote, Invoice, Shipments, Line Items.
- [ ] **quote-builder.md:135** — `images/hubspot-quote-linked-order.png` — Ecommerce Quote with linked Order in the sidebar.
- [ ] **quote-builder.md:137** — `images/hubspot-order-linked-quote.png` — Ecommerce Order with linked Quote in the sidebar.

## ③ Wrong / duplicate stand-ins — re-shoot (4)

These currently render but are byte-identical copies of another screenshot, so the content is wrong for the caption. Overwrite the file with a correct capture.

- [ ] **platform-overview.md:63** — `images/admin-dashboard.png` — **Currently a copy of the Order Lifecycle page.** Capture the real admin **dashboard landing page**: sync-status panels + key metric tiles.
- [ ] **credit-terms.md:154** — `images/admin-tax-exemption-requests.png` — **Currently a copy of the requests list.** Caption wants a request **detail** (certificate, exemption type, exempt regions). Easiest: re-point this embed to ①'s `admin-tax-exemption-request-detail.png` and delete this file.
- [ ] **key-concepts.md:129** — `images/hubspot-ecommerce-invoice-record.png` — **Currently a copy of the Refund-Manager card shot.** Capture the Invoice record focused on `ei_status` / `ei_total` / `ei_invoice_date` + the parent-Order association.
- [ ] **platform-overview.md:96** — `images/checkout-self-service-three-column.png` — Lowest priority: copy of `checkout-payment-methods-all-four.png`, which fits the caption. Re-shoot only if you want a distinct self-service example.

## ④ Orphan — decide

- [ ] `images/quote-builder-with-items.png` — exists on disk, referenced nowhere. Either wire it into `quote-builder.md` or delete it.
