# Admin API Reference

> **Audience note:** This page is part of the **Developer Reference** section. Unlike the rest of this guide (written for sales reps and admins), this page assumes you are integrating with the SCW Commerce admin API programmatically. Other Developer Reference pages — Customer / Storefront API, Cron Jobs & Webhooks, HubSpot Lambda Backend — will follow.

## Overview

The admin API is the set of endpoints under `/api/admin/*`. They are used by:

- The **SCW Commerce admin UI** (the internal admin tools used by SCW staff)
- The **HubSpot custom-cards lambda backend** — Quote Builder, Order Actions, and Refund Manager cards call these endpoints to perform privileged operations. See [Order Lifecycle → Admin Action Reference](order-lifecycle.md#admin-action-reference) for the user-facing context.

Privileged operations covered: invoicing, payment capture, refunds, manual HubSpot sync, dead-letter-queue management, and bulk imports.

## Authentication

Every endpoint listed below accepts **either** of these two schemes:

| Scheme | How to send it | Who typically uses it |
|---|---|---|
| **Admin session** | NextAuth session cookie with `role=admin` (the user signed in to the admin UI is in the admin allowlist) | The SCW Commerce admin UI |
| **Admin API key** | HTTP header `X-Admin-Api-Key: <ADMIN_API_KEY>` | External integrations — primarily the HubSpot lambda backend (`hubspotapp` repo, `origin/main`) |

If neither passes, the endpoint returns `401 Authentication required` (no credentials) or `403 Admin access required` (signed-in user is not in the admin allowlist).

Cron and webhook endpoints (outside this page's scope) use separate schemes — `Authorization: Bearer <CRON_SECRET>` for cron, signed payloads for inbound webhooks.

## Conventions

- **JSON only.** Success responses use either `{ ...data }` or `{ success: true, data: { ... } }`. Errors use `{ error: "...", code?: "..." }`.
- **Path params named `id`** accept the numeric primary key OR the human-readable identifier (order number `SCW-...`, invoice number, etc.) on endpoints that explicitly note both.
- **Outbox side effects.** Order, invoice, refund, and shipment mutations enqueue HubSpot sync through the durable outbox; each endpoint's HubSpot side effect is noted below. Manual `/api/admin/orders/[id]/sync` is available to force a re-sync if an outbox row was abandoned.
- **Idempotency.** Refund creation endpoints accept an `Idempotency-Key` header to guarantee at-most-once processing across retries.

---

## Orders

#### `GET /api/admin/orders`

- **Auth:** Admin (session or API key)
- **Purpose:** List orders with pagination, filtering, and HubSpot sync status.
- **Path params:** none
- **Query params:** see `adminOrderListQuerySchema`
- **Request body:** none
- **Response (200):** `{ orders[], total, page, limit, totalPages }`
- **Side effects:** read-only

#### `POST /api/admin/orders/from-quote`

- **Auth:** Admin (session or API key)
- **Purpose:** Create a `pending_payment` order from a HubSpot quote for offline payment methods (`check`, `ach_wire`, `purchase_order`). Used when the HubSpot/Lambda side sends the full quote payload rather than sending a customer through the payment-link checkout.
- **Path params:** none
- **Query params:** none
- **Request body:** `{ customerEmail, customerFirstName?, customerLastName?, billingAddress, shippingAddress, items[], subtotal, shippingAmount, taxAmount, grandTotal, shippingMethod?, paymentMethod, poNumber?, hubspotQuoteId?, hubspotContactId?, internalNotes? }`
- **Response (200):** `{ success, data: { orderId, orderNumber, status: 'pending_payment' } }`
- **Side effects:** Creates local order and pending payment record, links/heals the customer by HubSpot contact ID or email, sends confirmation/payment-instruction emails. It intentionally does **not** invoice or push to ShipEdge; admin invoicing is still required after payment/PO verification.

#### `GET /api/admin/orders/stats`

- **Auth:** Admin (session or API key)
- **Purpose:** Admin dashboard summary — order counts by status, total revenue, DLQ health, recent orders.
- **Path params:** none
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ ordersByStatus, totalRevenue, dlqHealth, recentOrderCount }`
- **Side effects:** read-only

#### `GET /api/admin/orders/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Full order lifecycle detail — items, payments, invoices, shipments, refunds, events, DLQ entries. The `[id]` param is always an **order number string**, never a numeric primary key. Accepted formats: current bare-numeric sequence numbers (`1268879530`), early sequence numbers (`ORD-000035`), legacy app-generated (`SCW-20260108-A1B2`), and Magento-migrated numeric strings (`1068850686` or `1068850686-1`). Because current order numbers are themselves bare integers, resolution matches the stored `order_number` column first, then falls back to a primary-key lookup — so a bare integer resolves as an order number when one exists. (Note: the `POST /[id]/capture` route parses `[id]` as an integer PK only.)
- **Path params:** `id: string (order number — see formats above)`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ id, orderNumber, status, items[], payments[], invoices[], shipments[], refunds[], events[] }`
- **Side effects:** read-only

#### `POST /api/admin/orders/[id]/capture`

- **Auth:** Admin (session or API key)
- **Purpose:** Capture an `auth_only` credit-card payment. Creates a capture payment record, auto-generates the invoice, and transitions the order to `paid`.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ message, payment, invoice }`
- **Side effects:** Authorize.net gateway call; DB writes (payment + local invoice + order status `paid`); ShipEdge sync triggered; HubSpot outbox enqueue. **Capture pushes to HubSpot automatically:** `InvoiceService.createFromOrder` enqueues `invoice.created` and `OrderService.updateStatus('paid')` enqueues `order.status_changed`, each on the durable outbox with its own idempotency key and an immediate delivery kickoff (backstopped by the `process-hubspot-outbox` cron). The order's HubSpot object already exists from the original `auth_only` checkout's `order.created` sync, so no enqueue ordering is required. No manual `/sync` is needed after capture — use `/api/admin/orders/[id]/sync` only to force a re-sync if an outbox row was abandoned.

#### `POST /api/admin/orders/[id]/invoice`

- **Auth:** Admin (session or API key)
- **Purpose:** Create an invoice for a `pending_payment` order, mark it paid, transition to `processing`, and push the order to ShipEdge. Called when the admin confirms offline payment received.
- **Path params:** `id: string (order number or numeric ID)`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ success, data: { orderId, orderNumber, invoiceId, invoiceNumber, newStatus } }`
- **Side effects:** DB writes (invoice + order status); ShipEdge sync triggered; HubSpot outbox enqueue.

#### `GET /api/admin/orders/[id]/invoices`

- **Auth:** Admin (session or API key)
- **Purpose:** List all invoices for an order.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ invoices[] }`
- **Side effects:** read-only

#### `POST /api/admin/orders/[id]/invoices`

- **Auth:** Admin (session or API key)
- **Purpose:** Create a full or partial invoice for an order. If `items[]` is present, creates a partial invoice; otherwise full.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** `createInvoiceSchema` | `createPartialInvoiceSchema`
- **Response (201):** `{ id, invoiceNumber, status, items[] }`
- **Side effects:** DB write (invoice + items); HubSpot outbox enqueue.

#### `POST /api/admin/orders/[id]/sync`

- **Auth:** Admin (session or API key)
- **Purpose:** Manually trigger a HubSpot sync for an order or child entity (invoice / shipment / refund). Use after fixing a DLQ entry, or to force a re-sync.
- **Path params:** `id: string (order number or numeric ID)`
- **Query params:** none
- **Request body:** `{ entityType: 'order' | 'invoice' | 'shipment' | 'refund', entityId?: number }`
- **Response (200):** `{ message, orderNumber, entityType, entityId }`
- **Side effects:** HubSpot sync queued and triggered immediately.

---

## Invoices

#### `GET /api/admin/invoices/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Get invoice detail with line items.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ id, invoiceNumber, orderId, status, items[], subtotal, taxAmount, grandTotal }`
- **Side effects:** read-only

#### `PATCH /api/admin/invoices/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Update invoice status (e.g. `paid`, `refunded`).
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** `updateInvoiceStatusSchema`
- **Response (200):** `{ id, invoiceNumber, status, notes }`
- **Side effects:** DB write (invoice status); HubSpot outbox enqueue.

---

## Refunds

#### `GET /api/admin/refunds/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Get refund detail with items and calculated amounts.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ id, refundNumber, orderId, invoiceId, status, items[], subtotal, taxAmount, grandTotal }`
- **Side effects:** read-only

#### `PATCH /api/admin/refunds/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Update refund status (e.g. `pending`, `processed`, `pending_settlement`).
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** `updateRefundStatusSchema`
- **Response (200):** `{ id, refundNumber, status, notes }`
- **Side effects:** DB write (refund status); HubSpot outbox enqueue.

#### `POST /api/admin/refunds/from-hubspot`

- **Auth:** Admin (session or API key)
- **Purpose:** Refund flow triggered by the HubSpot Refund Manager card via the lambda backend. Supports full, partial-dollar, and per-item refunds; processes via Authorize.net for online payments or directly for offline payments. Full refunds attempt to cancel the order. Idempotent via `Idempotency-Key`.
- **Path params:** none
- **Query params:** none
- **Request body:** `hubspotRefundRequestSchema`
- **Response (201):** `{ success, refundNumber, refundId, refundAmount, status, orderId, invoiceId }`
- **Side effects:** DB writes (refund + items + event log); Authorize.net gateway call (online payments only); TaxJar refund report queued/retried; order status updated if a full refund; HubSpot outbox enqueue.

#### `POST /api/admin/refunds/offline`

- **Auth:** Admin (session or API key)
- **Purpose:** Create a refund for non-gateway payment methods (Check, Wire, PO). Direct refund record creation with adjustment support. Idempotent.
- **Path params:** none
- **Query params:** none
- **Request body:** `hubspotRefundRequestSchema`
- **Response (201):** `{ success, refundNumber, refundId, refundAmount, status, mode, orderId, invoiceId }`
- **Side effects:** DB writes (refund + items + event log + order status if full); invoice status transitioned; settlement mode decided (`cash_refund` or `credit_only`); TaxJar report queued.

---

## Invitations

#### `GET /api/admin/invitations`

- **Auth:** Admin (session or API key)
- **Purpose:** List invitations, optionally filtered by status.
- **Path params:** none
- **Query params:** `page`, `limit`, `status[]` (optional)
- **Request body:** none
- **Response (200):** `{ invitations[], total, page, limit, totalPages }`
- **Side effects:** read-only

#### `POST /api/admin/invitations`

- **Auth:** Admin (session or API key)
- **Purpose:** Create a new admin/user invitation and send the signup email.
- **Path params:** none
- **Query params:** none
- **Request body:** `createInvitationSchema`
- **Response (200):** `{ message, invitation }`
- **Side effects:** DB write (invitation); sends invitation email; business event logged.

#### `GET /api/admin/invitations/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Get invitation details.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ id, email, status, expiresAt, createdAt }`
- **Side effects:** read-only

#### `DELETE /api/admin/invitations/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Revoke an invitation (status → `revoked`).
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ message, invitation }`
- **Side effects:** DB write (invitation status).

#### `POST /api/admin/invitations/[id]/resend`

- **Auth:** Admin (session or API key)
- **Purpose:** Resend the invitation email with a fresh token and extended expiry.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ message, invitation }`
- **Side effects:** DB write (new token + expiry); sends resent invitation email.

---

## Contacts

#### `GET /api/admin/contacts/import`

- **Auth:** Admin (session or API key)
- **Purpose:** List recent HubSpot contact import jobs.
- **Path params:** none
- **Query params:** see `syncJobListQuerySchema`
- **Request body:** none
- **Response (200):** `{ jobs[] }`
- **Side effects:** read-only

#### `POST /api/admin/contacts/import`

- **Auth:** Admin (session or API key)
- **Purpose:** Start a bulk import of contacts from HubSpot.
- **Path params:** none
- **Query params:** none
- **Request body:** `contactImportOptionsSchema`
- **Response (200):** `{ message, result }`
- **Side effects:** DB write (import job + imported contacts); contacts pulled from HubSpot API.

#### `POST /api/admin/contacts/import/preview`

- **Auth:** Admin (session or API key)
- **Purpose:** Dry-run preview of a contact import — shows what would be created/updated without writing anything.
- **Path params:** none
- **Query params:** none
- **Request body:** `contactImportOptionsSchema`
- **Response (200):** `{ previewData }`
- **Side effects:** read-only (preview only).

---

## Sync & Outbox

#### `GET /api/admin/sync/overview`

- **Auth:** Admin (session or API key)
- **Purpose:** Aggregated per-entity sync health, system indicators, flow diagram, and KPIs — populates the admin Sync dashboard in a single request.
- **Path params:** none
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ services[], entities[], indicators[], flow, kpis, generatedAt }`
- **Side effects:** read-only

#### `GET /api/admin/sync/events`

- **Auth:** Admin (session or API key)
- **Purpose:** Merged stream of recent outbox events (newest first) across `hubspot_outbox`, `make_outbox`, and the DLQ.
- **Path params:** none
- **Query params:** `limit` (1–200, default 50), `status` (optional), `source` (optional: `hubspot_outbox` | `make_outbox` | `dlq`)
- **Request body:** none
- **Response (200):** `{ events[], generatedAt }`
- **Side effects:** read-only

#### `POST /api/admin/sync/events/retry`

- **Auth:** Admin (session or API key)
- **Purpose:** Replay an abandoned `hubspot_outbox` row. Resets the row to `pending` with `attempt_count = 0` and kicks off immediate redelivery — the recovery path for rows that abandoned on a non-retryable error (4xx) whose root cause has since been fixed (e.g. portal object cap raised, enum option added in HubSpot). Surfaced in the admin Sync Observability dashboard as a **Retry** button on abandoned HubSpot events. Every abandonment also raises a Sentry error (`hubspot_outbox_abandoned`), so failed syncs alert instead of waiting to be noticed.
- **Path params:** none
- **Query params:** none
- **Request body:** `{ source: 'hubspot_outbox', id: number }`
- **Response (200):** `{ retried, id, eventType, entityType, entityId }`; `409` if the row doesn't exist or isn't abandoned
- **Side effects:** outbox row re-queued; immediate delivery attempt; business event logged.

#### `GET /api/admin/sync/dlq`

- **Auth:** Admin (session or API key)
- **Purpose:** List dead-letter-queue items with filtering and stats.
- **Path params:** none
- **Query params:** `page`, `limit`, `status[]` (optional)
- **Request body:** none
- **Response (200):** `{ items[], total, page, limit, totalPages, stats }`
- **Side effects:** read-only

#### `POST /api/admin/sync/dlq`

- **Auth:** Admin (session or API key)
- **Purpose:** Manually retry one or more DLQ items.
- **Path params:** none
- **Query params:** none
- **Request body:** `dlqRetrySchema`
- **Response (200):** `{ message, results[] }`
- **Side effects:** DLQ items re-queued for retry; business event logged.

#### `GET /api/admin/sync/dlq/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Get a single DLQ item by ID.
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ id, jobType, entityType, status, errorMessage, createdAt }`
- **Side effects:** read-only

#### `PATCH /api/admin/sync/dlq/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Mark a DLQ item as resolved (manually fixed).
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** `dlqResolveSchema`
- **Response (200):** `{ message, item }`
- **Side effects:** DB write (DLQ item status).

#### `GET /api/admin/integrations/make/outbox`

- **Auth:** Admin (session or API key)
- **Purpose:** List Make.com outbox items with pagination.
- **Path params:** none
- **Query params:** `page`, `limit`, plus filters via `makeOutboxListQuerySchema`
- **Request body:** none
- **Response (200):** `{ items[], total, page, limit, totalPages }`
- **Side effects:** read-only

#### `POST /api/admin/integrations/make/outbox/[id]/retry`

- **Auth:** Admin (session or API key)
- **Purpose:** Manually retry a Make.com outbox item (re-fires the webhook).
- **Path params:** `id: number`
- **Query params:** none
- **Request body:** none
- **Response:** Four distinct shapes depending on the item's state:
  - **404** `{ error, code: 'OUTBOX_NOT_FOUND' }` — item does not exist (no `item` field)
  - **409** `{ error, code: 'OUTBOX_PROCESSING', item }` — item is mid-flight in another worker; try again shortly
  - **200** `{ ok: true, noOp: true, code: 'OUTBOX_ALREADY_DELIVERED', item }` — already delivered; no action taken
  - **200** `{ ok: true, item }` — retry was triggered successfully (no `code` field in this case)
- **Side effects:** DB write (outbox item status); Make.com webhook re-triggered.

---

## Misc

#### `GET /api/admin/cron-status`

- **Auth:** Admin (session or API key)
- **Purpose:** Last-run status of every cron job (reads `logs/cron/status.json`).
- **Path params:** none
- **Query params:** none
- **Request body:** none
- **Response (200):** `{ overall: 'healthy' | 'degraded', summary, crons[], checkedAt }`
- **Side effects:** read-only (file read only).

#### `GET /api/admin/next-id`

- **Auth:** Admin (session or API key)
- **Purpose:** Get the next sequential ID for an entity type. Single source of truth in PostgreSQL — used by the HubSpot lambda to allocate human-readable IDs.
- **Path params:** none
- **Query params:** `entity: 'order' | 'invoice' | 'refund' | 'shipment'`
- **Request body:** none
- **Response (200):** `{ id: number, entity }`
- **Side effects:** DB write (ID sequence incremented).

#### `POST /api/admin/tax/calculate`

- **Auth:** Admin (session or API key)
- **Purpose:** Calculate tax for an address without going through a cart. Supports customer exemption lookup by email.
- **Path params:** none
- **Query params:** none
- **Request body:** `{ shippingAddress, subtotal, shippingAmount?, lineItems?, customerEmail? }`
- **Response (200):** `{ success, tax: { amount, rate, hasNexus, freightTaxable, fallback, breakdown? } }`
- **Side effects:** TaxJar API call; DB read for customer-exemption lookup.

---

## Quotes

#### `POST /api/admin/quotes/send-proposal-email`

- **Auth:** Admin (session or API key)
- **Purpose:** Send a Cart2Quote-style quote-proposal email (with PDF attachment) to a customer. Called by the HubSpot Lambda when a rep sends a quote from the HubSpot Quote Builder card.
- **Path params:** none
- **Query params:** none
- **Request body:** `{ to, customerName, repName, repEmail, quoteNumber, quoteDate?, validUntil?, sections[], totals, billingAddress, shippingAddress, shippingMethod?, paymentLinkUrl, ctaLabel?, customerNote?, pdf: { filename, base64 } }`
- **Response (200):** `{ success: true, status: 'sent' }`
- **Response (502):** `{ success: false, status: 'failed', error }`
- **Side effects:** Sends email with PDF attachment via the configured email service.

---

## Products

#### `GET /api/admin/products`

- **Auth:** Admin (session or API key)
- **Purpose:** List products with pagination and filtering. Powers the admin product listing page.
- **Path params:** none
- **Query params:** pagination + filter params
- **Response (200):** `{ products[], total, page, limit, totalPages }`
- **Side effects:** read-only

#### `POST /api/admin/products`

- **Auth:** Admin (session or API key)
- **Purpose:** Create a new product.
- **Path params:** none
- **Request body:** product creation schema
- **Response (201):** created product object
- **Side effects:** DB write; search index updated.

#### `GET /api/admin/products/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Get full product detail for the admin product editor.
- **Path params:** `id: number`
- **Response (200):** product detail object
- **Side effects:** read-only

#### `PATCH /api/admin/products/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Update product fields.
- **Path params:** `id: number`
- **Request body:** partial product update schema
- **Response (200):** updated product object
- **Side effects:** DB write; search index updated.

#### `DELETE /api/admin/products/[id]`

- **Auth:** Admin (session or API key)
- **Purpose:** Delete a product.
- **Path params:** `id: number`
- **Response (200):** `{ success: true }`
- **Side effects:** DB write; search index updated.

#### `GET /api/admin/products/[id]/images` / `PATCH /api/admin/products/[id]/images`

- Manage the product's image set (list or replace).

#### `POST /api/admin/products/[id]/images/upload`

- Upload a new image for the product.

#### `GET /api/admin/products/[id]/categories` / `POST /api/admin/products/[id]/categories`

- List or assign categories for the product.

#### `GET /api/admin/products/[id]/options` / `PATCH /api/admin/products/[id]/options`

- Get or update product options/variants.

#### `GET /api/admin/products/[id]/related` / `PATCH /api/admin/products/[id]/related`

- Get or update related products.

#### `GET /api/admin/products/[id]/tier-prices` / `POST /api/admin/products/[id]/tier-prices`

- Get or set quantity-based tier prices.

#### `GET /api/admin/products/[id]/group-prices` / `POST /api/admin/products/[id]/group-prices`

- Get or set customer-group-specific prices.

#### `POST /api/admin/products/[id]/resync`

- **Auth:** Admin (session or API key)
- **Purpose:** Re-sync a product to the search index and any downstream systems.
- **Path params:** `id: number`
- **Response (200):** `{ success: true }`
- **Side effects:** search index updated.

---

## Tax Exemptions

#### `GET /api/admin/tax-exemptions`

- **Auth:** Admin (session or API key)
- **Purpose:** Read-only list of tax-exempt customers. Changes to exemption status are made through the exemption-request approval flow or org-level domain config, not directly through this endpoint.
- **Path params:** none
- **Query params:** pagination + filter params
- **Response (200):** `{ exemptions[], total, page, limit, totalPages }`
- **Side effects:** read-only

#### `GET /api/admin/tax-exempt-orgs`

- **Auth:** Admin (session or API key)
- **Purpose:** List tax-exempt organizations with their associated email domains.
- **Path params:** none
- **Query params:** pagination + filter params
- **Response (200):** `{ orgs[], total, page, limit, totalPages }`
- **Side effects:** read-only

#### `POST /api/admin/tax-exempt-orgs`

- **Auth:** Admin (session or API key)
- **Purpose:** Create a new tax-exempt org and cascade the exemption to all existing customers whose email domains match the org's configured domains.
- **Path params:** none
- **Request body:** org creation schema (name, domains[], exemption details)
- **Response (201):** created org object
- **Side effects:** DB write (org + cascaded customer exemptions); TaxJar customer sync.

#### `GET /api/admin/tax-exempt-orgs/[id]` / `PATCH /api/admin/tax-exempt-orgs/[id]` / `DELETE /api/admin/tax-exempt-orgs/[id]`

- Get, update, or delete a tax-exempt org by ID.

#### `GET /api/admin/tax-exemption-requests`

- **Auth:** Admin (session or API key)
- **Purpose:** List exemption requests with `status`, `page`, and `pageSize` filter support.
- **Path params:** none
- **Query params:** `status`, `page`, `pageSize`
- **Response (200):** `{ requests[], total, page, limit, totalPages }`
- **Side effects:** read-only

#### `POST /api/admin/tax-exemption-requests`

- **Auth:** Admin (session or API key)
- **Purpose:** Admin creates an exemption request on behalf of a customer (`multipart/form-data`). Accepts `customerEmail` plus supporting document uploads.
- **Path params:** none
- **Request body:** `multipart/form-data` — `customerEmail` + document files
- **Response (201):** created request object
- **Side effects:** DB write (request + documents).

#### `GET /api/admin/tax-exemption-requests/[id]` / `PATCH /api/admin/tax-exemption-requests/[id]`

- Get or update an exemption request by ID.

#### `POST /api/admin/tax-exemption-requests/[id]/approve`

- **Auth:** Admin (session or API key)
- **Purpose:** Approve an exemption request — marks the customer tax-exempt and syncs to TaxJar.
- **Path params:** `id: number`
- **Response (200):** `{ success: true, request }`
- **Side effects:** DB write (request status + customer exemption flag); TaxJar customer sync.

#### `POST /api/admin/tax-exemption-requests/[id]/reject`

- **Auth:** Admin (session or API key)
- **Purpose:** Reject an exemption request.
- **Path params:** `id: number`
- **Response (200):** `{ success: true, request }`
- **Side effects:** DB write (request status).

---

## Supporting Read Endpoints

#### `GET /api/admin/categories`

- **Auth:** Admin (session or API key)
- **Purpose:** Read-only list of categories. Used by the admin product editor to populate category selectors.
- **Response (200):** `{ categories[] }`
- **Side effects:** read-only

#### `GET /api/admin/customer-groups`

- **Auth:** Admin (session or API key)
- **Purpose:** Read-only list of customer groups. Used by the admin product editor to populate group-price selectors.
- **Response (200):** `{ groups[] }`
- **Side effects:** read-only

---

## What's not yet documented

Future **Developer Reference** pages will cover:

- **Customer / Storefront API** — `/api/cart/*`, `/api/checkout/*`, `/api/orders/*`, `/api/products/*`, `/api/search/*`, `/api/customers/*`, `/api/auth/*`, `/api/categories/*`, `/api/invitations/*`, `/api/tax/*`, `/api/shipping/*`, `/api/deals/*`.
- **Cron jobs and webhook receivers** — `/api/cron/*` (auth via `Authorization: Bearer <CRON_SECRET>`) and `/api/webhooks/*` (signed payloads).
- **HubSpot Lambda/backend apps** — current SCW Commerce endpoints include signed Ecommerce Quote payment-link checkout and order-from-quote creation. Older HubSpot app repos may still contain legacy Magento quote automation, so verify the deployed HubSpot extension before changing quote-card behavior.
