# Make Automation Migration Guide

## Goal

Move the Make.com automations that currently depend on Magento 2 onto SCW Commerce.

Use this cutover pattern:

<section class="modern-flow" aria-label="SCW Commerce to Make migration flow">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Replacement pattern</span>
      <span class="modern-flow__title">SCW Commerce creates the order, notifies Make, and Make reads the full order from SCW</span>
    </div>
    <span class="modern-flow__badge">Magento retired</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">Order Created<small>SCW checkout or admin order flow</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Make Outbox<small>Durable webhook row with retries</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">Make Webhook<small>Scenario receives order event</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">Order API Read<small>Optional — full order already in payload; read API available if needed</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--done">Downstream Work<small>HubSpot, Knack, Xero, email, Shield</small></span>
  </div>
  <div class="modern-flow__note">The webhook body already contains the full nested order object. Treat the webhook as both trigger and data source. The SCW order read API is available for supplemental lookups. Do not keep Magento order polling or Magento write modules in the cutover version.</div>
</section>

## What Changes

| Old Magento pattern | New SCW Commerce pattern |
|---|---|
| `magento2:watchOrders` watches Magento for new orders | SCW Commerce sends `order.created` to a Make custom webhook |
| `magento2:findOrders2` or `magento2:getOrder` reads Magento order details | The full order is embedded in the `order.created` webhook payload; Make can also call `GET /api/integrations/make/orders/by-number/{orderNumber}` for supplemental lookups |
| Magento `increment_id` is the business order number | SCW `order_number` is the business order number, and the API also returns `increment_id` as an alias |
| Magento `entity_id` is often used as the internal order id | SCW returns `id` and `entity_id`, but Make should not use either as the customer-facing order number |
| Magento shipment/status/comment modules write back to Magento | Use SCW Make write endpoints only when that write is supported and idempotent |
| Magento polling is the fallback | SCW Make outbox retries delivery automatically |

---

## Environments And Secrets

The SCW deploy owner will provide these values to Make. Do not paste real secrets into tickets, docs, screenshots, or blueprint exports.

| Name | Used by | Purpose |
|---|---|---|
| `SCW_COMMERCE_BASE_URL` | Make | Base URL for SCW Commerce API calls, for example staging or production |
| `MAKE_INTEGRATION_SECRET` | Make -> SCW | Bearer token for `/api/integrations/make/*` routes |
| `MAKE_ORDER_CREATED_WEBHOOK_URL` | SCW -> Make | Make custom webhook URL for normal `order.created` events. Now also editable in the admin UI — a saved value there overrides this env var (see [Editing webhook URLs in the admin](#editing-webhook-urls-in-the-admin)). |
| `MAKE_MONITORING_ORDER_WEBHOOK_URL` | SCW -> Make | Optional separate webhook for `order.created.monitoring_candidate` events. Now also editable in the admin UI — a saved value there overrides this env var. |
| `MAKE_REFUND_CREATED_WEBHOOK_URL` | SCW -> Make | Make custom webhook URL for `refund.created` events. Editable in the admin UI. |
| `MAKE_TAX_EXEMPTION_WEBHOOK_URL` | SCW -> Make | Make custom webhook URL for `tax_exemption.submitted`, `tax_exemption.approved`, and `tax_exemption.rejected` events (all three share one URL by default; any can be overridden per-event in the admin UI). |
| `MAKE_OUTBOX_ENABLED` | SCW | Must be enabled before SCW sends Make webhooks |
| `MAKE_OUTBOX_TIMEOUT_MS` | SCW | Timeout for each Make webhook delivery attempt |
| `MAKE_OUTBOX_BATCH_SIZE` | SCW | Maximum due webhook rows processed per cron tick |

SCW sends outbound Make events through a durable `make_integration_outbox` table. The cron `process-make-outbox` runs every minute and retries transient failures with backoff.

### Editing webhook URLs in the admin

All outbound webhook URLs are editable at runtime from **Admin → Integrations → Make Webhooks** (`/admin/integrations/make`), so a URL can be changed without a redeploy. The page shows one row per event type: `order.created`, `order.created.monitoring_candidate`, `refund.created`, `tax_exemption.submitted`, `tax_exemption.approved`, and `tax_exemption.rejected`.

How it resolves, per event:

- **Saved value wins.** If an admin saves a URL on this page, SCW sends to that URL.
- **Otherwise the env var is the fallback** (`MAKE_ORDER_CREATED_WEBHOOK_URL` / `MAKE_MONITORING_ORDER_WEBHOOK_URL`). With nothing saved, behavior is exactly as before.
- **Blank the field to clear it** back to the env fallback.
- **Enable / disable each event.** Disabling an event means SCW does not queue or send that webhook for **future** orders (it logs `make_webhook_skipped`); already-queued events are unaffected. Re-enabling applies to orders created after the change is saved.

Notes:

- `MAKE_OUTBOX_ENABLED` is still the global master switch — if it is off, SCW sends nothing regardless of these per-event settings.
- The page shows a source badge per event: **Saved (DB)**, **Env fallback**, or **Not configured**.
- The webhook URL carries the Make hook token, so treat it as a secret; the URL field is masked by default.

---

## SCW -> Make Webhook Contract

SCW posts JSON to the configured Make custom webhook URL when an order is created.

### Event Types

| Event type | When it fires | Use it for |
|---|---|---|
| `order.created` | Every new SCW order when the Make outbox is enabled | General Magento `watchOrders` replacement |
| `order.created.monitoring_candidate` | New order contains a SKU with the monitoring marker `74HUB` | Shield / monitoring-specific scenarios |
| `refund.created` | A refund record is created in SCW Commerce | Downstream refund workflows (Xero, Knack, notifications) |
| `tax_exemption.submitted` | A customer submits a tax exemption request | Notify admin team, trigger doc-collection workflow |
| `tax_exemption.approved` | An SCW admin approves the exemption request | Notify customer, update downstream systems |
| `tax_exemption.rejected` | An SCW admin rejects the exemption request | Notify customer |

`order.created.monitoring_candidate` is additional to the normal event. If a monitoring order should only run one scenario, filter by `event_type` in Make and/or use the separate monitoring webhook URL.

The three `tax_exemption.*` events share a single webhook URL by default (`MAKE_TAX_EXEMPTION_WEBHOOK_URL`). A single Make scenario can branch on the top-level `status` field (`submitted` / `approved` / `rejected`) rather than parsing the dotted `event_type`.

### Headers

| Header | Meaning |
|---|---|
| `content-type: application/json` | Webhook body format |
| `x-scw-event-id` | Unique event id for dedupe |
| `x-scw-event-type` | `order.created` or `order.created.monitoring_candidate` |
| `x-scw-occurred-at` | Order-created timestamp |
| `x-scw-timestamp` | Delivery timestamp |
| `x-scw-signature-v1` | HMAC-SHA256 where the key is the Make webhook URL itself and the signed message is `<x-scw-timestamp>.<raw-body>` (the timestamp value, a dot, then the full JSON body) |

For dedupe in Make, store `x-scw-event-id` or the tuple `event_type + order_number`. Make scenarios that perform writes must be safe to receive the same event more than once.

### Payload

```json
{
  "event_id": "evt_...",
  "event_type": "order.created",
  "occurred_at": "2026-05-15T12:00:00.000Z",
  "order_id": 12345,
  "order_number": "SCW-20260515-ABCD",
  "customer_id": 987,
  "customer_email": "buyer@example.com",
  "payment_method": "purchase_order",
  "po_number": "PO-10001",
  "quote_reference": "123456789",
  "hubspot_deal_id": "123456789",
  "grand_total": "1499.99",
  "tax_amount": "85.12",
  "shipping_amount": "24.99",
  "status": "pending_payment",
  "items": [
    {
      "product_id": 111,
      "sku": "74HUB-EXAMPLE",
      "name": "Example Product",
      "quantity": 1,
      "unit_price": "1390.00"
    }
  ]
}
```

The webhook payload includes a full nested `order` object (the complete Magento-compatible order — line items, addresses, payment details, shipments, invoices, refunds, events) alongside the compact top-level fields. Make can map most fields directly from the embedded `order` object; calling the read API again is optional, not required.

> [SCREENSHOT: The Make.com scenario data inspector showing the full SCW order.created webhook payload including the nested order object alongside the compact top-level fields. — images/make-webhook-payload-inspector.png]

---

## Make -> SCW API Contract

All Make integration API calls use:

```http
Authorization: Bearer {{MAKE_INTEGRATION_SECRET}}
```

Write routes also require:

```http
X-Idempotency-Key: {{unique_key_for_this_write}}
```

Recommended idempotency key format:

```text
make:{{scenario_name}}:{{order_number}}:{{action_name}}:{{source_event_id_or_tracking_number}}
```

### Read Full Order By Number

Use this for supplemental field lookups or when building scenarios that are triggered outside the webhook (for example, Knack-triggered scenarios). The webhook payload already embeds the full order, so this call is not required after an `order.created` trigger.

```http
GET {{SCW_COMMERCE_BASE_URL}}/api/integrations/make/orders/by-number/{{order_number}}
Authorization: Bearer {{MAKE_INTEGRATION_SECRET}}
```

Success returns one full order. Important response fields:

| Field | Notes |
|---|---|
| `order_number`, `orderNumber`, `increment_id` | Same business order number. Use this instead of Magento `entity_id`. |
| `id`, `entity_id` | SCW internal numeric id. Useful for diagnostics, not for customer-facing references. |
| `customer_email`, `customerEmail` | Customer email |
| `payment_method`, `paymentMethod` | Payment method, for example `purchase_order` |
| `po_number`, `poNumber` | Purchase order number when present |
| `hubspot_deal_id`, `hubspotDealId`, `quote_reference` | HubSpot Ecommerce Quote object ID for orders that originated from a HubSpot quote payment link. Despite the column name, it never holds a HubSpot Deal ID (a rename is pending). |
| `billing_address`, `billingAddress` | Billing address object |
| `shipping_address`, `shippingAddress` | Shipping address object |
| `items`, `line_items` | Same line item list; `line_items` exists for Magento-style mappings |
| `payments`, `shipments`, `invoices`, `refunds`, `events` | Related lifecycle records |

### Search Orders

Use this for scenarios that previously searched Magento by customer/domain/date.

```http
GET {{SCW_COMMERCE_BASE_URL}}/api/integrations/make/orders/search?customerEmailDomain=example.com&limit=100
Authorization: Bearer {{MAKE_INTEGRATION_SECRET}}
```

Supported query parameters:

| Parameter | Meaning |
|---|---|
| `orderNumber` | Exact order number |
| `customerId` | Exact SCW customer id |
| `customerEmail` | Exact customer email |
| `customerEmailDomain` | Email domain, with or without leading `@` |
| `createdFrom` | Created at or after this timestamp/date |
| `createdTo` | Created at or before this timestamp/date |
| `limit` | 1 to 1000, default 100 |

Current search does not support free-text Magento description search. If an old scenario finds Magento orders by deal description, update the upstream Knack/HubSpot step to pass a real `orderNumber` or use a supported search filter.

### Add Order Comment

```http
POST {{SCW_COMMERCE_BASE_URL}}/api/integrations/make/orders/by-number/{{order_number}}/comments
Authorization: Bearer {{MAKE_INTEGRATION_SECRET}}
X-Idempotency-Key: make:shipment-comment:{{order_number}}:{{tracking_number}}
Content-Type: application/json
```

```json
{
  "comment": "Shipment recorded from Make.",
  "visibleToCustomer": false,
  "source": "shipedge-shipment-notification",
  "dryRun": true
}
```

Optional `status` can be included when the comment should also move the order through a valid status transition. Use `dryRun: true` first while building the scenario.

### Record Shipment

```http
POST {{SCW_COMMERCE_BASE_URL}}/api/integrations/make/orders/by-number/{{order_number}}/shipments
Authorization: Bearer {{MAKE_INTEGRATION_SECRET}}
X-Idempotency-Key: make:shipment:{{order_number}}:{{tracking_number}}
Content-Type: application/json
```

```json
{
  "carrier": "UPS",
  "trackingNumber": "1Z999AA10123456784",
  "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA10123456784",
  "items": [
    { "sku": "EXAMPLE-SKU", "quantity": 1 }
  ],
  "notifyCustomer": false,
  "source": "shipedge-shipment-notification",
  "dryRun": true
}
```

If `trackingNumber` already exists for the order, SCW updates/dedupes the shipment instead of creating a duplicate.

### Update Order Status

```http
PATCH {{SCW_COMMERCE_BASE_URL}}/api/integrations/make/orders/by-number/{{order_number}}/status
Authorization: Bearer {{MAKE_INTEGRATION_SECRET}}
X-Idempotency-Key: make:status:{{order_number}}:{{next_status}}:{{event_id}}
Content-Type: application/json
```

```json
{
  "status": "shipped",
  "internalNote": "Updated from Make shipment scenario.",
  "source": "shipedge-shipment-notification",
  "dryRun": true
}
```

Supported statuses: `pending`, `pending_payment`, `authorized`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`.

---

## Magento Field Mapping

| Magento field used in Make | SCW replacement |
|---|---|
| `increment_id` | `order_number` or `increment_id` |
| `entity_id` | `id` / `entity_id` only for diagnostics; do not use as order number |
| `customer_email` | `customer_email` |
| `customer_id` | `customer_id` |
| `payment.method` | `payment_method` |
| `payment.last_trans_id` | Use `payments[]` from the full order response |
| `billing_address.*` | `billing_address.*` |
| `shipping_address.*` | `shipping_address.*` |
| `items[]` | `items[]` or `line_items[]` |
| `items[].qty_ordered` | `line_items[].qty_ordered` or `items[].quantity` |
| `grand_total` | `grand_total` |
| `tax_amount` | `tax_amount` |
| `shipping_amount` | `shipping_amount` |
| `status` | `status` |

Prefer the SCW response field names for new modules. The Magento-style aliases exist to make migration easier, not to keep Magento as the mental model forever.

---

## Scenario Migration Matrix

Use this as the starting checklist for the Make rebuild. Confirm each scenario is active in Make before changing it, then replace only the Magento-dependent modules in that scenario.

| Make export | Current Magento dependency | SCW replacement |
|---|---|---|
| `M2 Order: check for PO; Check for deal with matching quote` | `magento2:watchOrders`, `magento2:findOrders2` | Replace the trigger with SCW `order.created`. Read the full order by `order_number`. Map PO/deal/customer/contact logic from the SCW order response. |
| `Create Master User Shield -trigger is Magento` | `magento2:watchOrders`, `magento2:getOrder` | Use `order.created.monitoring_candidate` when possible. Read the full order by number and map Shield logic from `items`, `customer_email`, addresses, and payment fields. |
| `Initiate SHIELD Account` | Knack-triggered scenario that uses `magento2:findOrders2` by order number | Keep the Knack trigger, but replace Magento lookup with `GET /orders/by-number/{orderNumber}`. Use `payments[]` instead of Magento `payment.last_trans_id` when needed. |
| `Aggregate Orders by Domain` | `magento2:findOrders2` | Use `GET /orders/search?customerEmailDomain=...&createdFrom=...&createdTo=...&limit=1000`, then aggregate the returned `orders[]`. |
| `Create True Up Records / Batch Pull Orders` | `magento2:findOrders2` matching deal description | Prefer passing `orderNumber` from the upstream DTO. If only customer/date/domain is available, use `/orders/search`. Free-text deal-description search is not currently supported. |
| `Force Update of Individual Deal` | `magento2:findOrders2` matching deal description | Same as true-up: pass `orderNumber` when possible, otherwise use supported search filters. Keep HubSpot/Xero/Knack updates mapped from the SCW order response. |
| `Shipedge Shipment Webhook: Notification Email + Invoice if PO` | `magento2:findOrders2`, `magento2:shipAnOrder`, Magento universal status/comment modules | Keep the ShipEdge trigger if this scenario remains active. Replace Magento lookup with SCW order read. Replace Magento shipment/status/comment writes with SCW Make write endpoints and idempotency keys. |
| `Simple Return - Shipedge -> RMA Tracker` | `magento2:findOrders2` from ShipEdge return payload | Keep the ShipEdge return trigger. Use `return.order.order_number` or `return.order.order_reference` to read the SCW order, then continue RMA/Knack/HubSpot mapping from that response. |
| `Recalculate Sales Tax on a Transaction` | `magento2:findOrders2` plus tax/refund HTTP work | Replace the Magento order lookup with SCW order read. Do not move tax/refund mutations to SCW until a dedicated SCW integration endpoint exists for that action. |
| `Sales Tax only Refunds on Magento Transactions` | `magento2:findOrders2` plus tax/refund HTTP work | Same as above: order lookup can move now; tax/refund write behavior needs explicit SCW endpoint support before cutover. |

Disabled branches should not drive the live migration plan. Only migrate branches that are enabled in the active Make scenario.

---

## Make Team Build Checklist

1. Duplicate the existing Make scenario and keep the Magento-backed original paused as the rollback copy.
2. Replace `magento2:watchOrders` triggers with a Make Custom Webhook.
3. Give the new webhook URL to the SCW deploy owner for `MAKE_ORDER_CREATED_WEBHOOK_URL` or `MAKE_MONITORING_ORDER_WEBHOOK_URL`.
4. The webhook body already contains a full nested `order` object. Map downstream modules directly from `order.*` in the webhook payload. Optionally add an HTTP `GET` to `/api/integrations/make/orders/by-number/{{order_number}}` if you need fields not present in the embedded object.
5. Remap downstream modules from the `order` object in the webhook payload (or the HTTP read response if you added step 4).
6. Replace `magento2:findOrders2` lookups with `/orders/by-number` or `/orders/search`.
7. Replace Magento shipment/status/comment writes only with supported SCW Make write endpoints.
8. Add `X-Idempotency-Key` to every SCW write request.
9. Build write steps with `dryRun: true`, inspect the response, then switch to `dryRun: false` only after approval.
10. Add a Make datastore or other dedupe step keyed by `x-scw-event-id` or `event_type + order_number`.
11. Test with staging SCW orders before production.
12. After production cutover, disable Magento polling scenarios. Do not run Magento and SCW triggers for the same business action.

---

## Cutover Validation

Before enabling a production scenario:

- Make receives a staged `order.created` event from SCW.
- Downstream modules map from the `order` object in the webhook payload (or, if using the optional read step, the HTTP GET response returns the order successfully with bearer auth).
- The scenario uses `order_number`, not Magento `entity_id`, for business references.
- Any SCW write request has a stable `X-Idempotency-Key`.
- Any write request has been tested with `dryRun: true`.
- Unsupported tax/refund/invoice mutations are either still outside the cutover or have a dedicated SCW endpoint approved by engineering.
- The old Magento module is removed or disabled in the new scenario.
- The scenario can safely ignore duplicate webhook deliveries.
- SCW admins can see Make outbox rows moving to `delivered` in the Sync Observability dashboard at `/admin/sync-observability` (the "Make" tab).

SCW engineers can inspect delivery health with:

```http
GET /api/admin/integrations/make/outbox
POST /api/admin/integrations/make/outbox/{id}/retry
```

Those admin endpoints are for SCW operators, not for Make scenario runtime calls.

---

## Do Not Do This

- Do not keep `magento2:watchOrders` running after SCW production cutover.
- Do not use Magento `entity_id` as the order number.
- Do not call SCW admin APIs from Make unless engineering explicitly approves that scenario.
- Do not recreate order totals, tax, payment state, or fulfillment state inside Make.
- Do not write directly to the SCW database.
- Do not paste Make connections, API keys, webhook URLs, or raw blueprint exports into public docs or tickets.
- Do not assume the top-level webhook fields are the only data available — the payload already includes a full nested `order` object with line items, addresses, payments, shipments, invoices, refunds, and events. Use it directly or call the read API for field references not covered by the embedded object.
