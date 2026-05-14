# Order Lifecycle & Status Flow

## Overview

Every order moves through a defined set of statuses. Each status transition is triggered by a specific event — either automatic (system) or manual (admin action).

---

## Status Flow Diagram

<section class="status-flow" aria-label="SCW Commerce order status flow">
  <div class="status-flow__header">
    <div>
      <p class="status-flow__eyebrow">Order starts here</p>
      <h3>Placed order enters the payment decision path</h3>
    </div>
    <span class="status-flow__badge">SCW Commerce</span>
  </div>
  <div class="status-flow__stage status-flow__stage--start">
    <div class="status-node status-node--created">
      <span class="status-node__label">Order Placed</span>
      <span class="status-node__meta">Customer submits checkout</span>
    </div>
    <span class="status-flow__connector" aria-hidden="true"></span>
    <div class="status-node">
      <span class="status-node__label">pending</span>
      <span class="status-node__meta">Order just created</span>
    </div>
  </div>
  <div class="status-flow__split" aria-label="Payment method branches">
    <article class="status-path status-path--card">
      <div class="status-path__title">
        <span>Credit Card</span>
        <small>default</small>
      </div>
      <div class="status-node status-node--success">
        <span class="status-node__label">paid</span>
        <span class="status-node__meta">Payment charged</span>
      </div>
    </article>
    <article class="status-path status-path--offline">
      <div class="status-path__title">
        <span>Offline Methods</span>
        <small>Check / Wire / PO</small>
      </div>
      <div class="status-node status-node--waiting">
        <span class="status-node__label">pending_payment</span>
        <span class="status-node__meta">Waiting for admin invoice</span>
      </div>
      <div class="status-action">Admin clicks <strong>Invoice</strong></div>
    </article>
    <article class="status-path status-path--auth">
      <div class="status-path__title">
        <span>Auth-Only</span>
        <small>rare</small>
      </div>
      <div class="status-node status-node--hold">
        <span class="status-node__label">authorized</span>
        <span class="status-node__meta">Card held, not charged</span>
      </div>
      <div class="status-action">Admin clicks <strong>Capture</strong></div>
      <div class="status-node status-node--success">
        <span class="status-node__label">paid</span>
        <span class="status-node__meta">Payment captured</span>
      </div>
    </article>
  </div>
  <div class="status-flow__merge">
    <span class="status-flow__merge-line" aria-hidden="true"></span>
    <div class="status-node status-node--processing">
      <span class="status-node__label">processing</span>
      <span class="status-node__meta">ShipEdge has the order</span>
    </div>
  </div>
  <div class="status-flow__fulfillment" aria-label="Fulfillment statuses">
    <div class="status-step">
      <span class="status-step__trigger">ShipEdge creates shipping label</span>
      <div class="status-node status-node--shipping">
        <span class="status-node__label">shipped</span>
        <span class="status-node__meta">Tracking # assigned</span>
      </div>
    </div>
    <div class="status-step">
      <span class="status-step__trigger">Carrier delivers</span>
      <div class="status-node status-node--done">
        <span class="status-node__label">delivered</span>
        <span class="status-node__meta">Order complete</span>
      </div>
    </div>
  </div>
  <aside class="status-flow__cancel">
    <strong>Cancellation path:</strong> Check / Wire orders auto-cancel from <code>pending_payment</code> when stale; manual cancellation is an internal admin/engineering correction and ShipEdge cancellation is separate once fulfillment has started.
  </aside>
</section>

---

## Status Definitions

| Status | Meaning | Who Triggers It | What's Happening |
|---|---|---|---|
| `pending` | Order just created, payment not yet attempted | System (automatic) | Exists for milliseconds before payment result |
| `pending_payment` | Waiting for offline payment (Check, Wire, or PO) | System (automatic for offline methods) | Admin must invoice to proceed. **ShipEdge does NOT have this order.** |
| `authorized` | Card authorized but not charged (auth-only mode) | System (rare — only for auth-only transactions) | Admin must capture to proceed |
| `paid` | Payment successfully charged | System (Authorize.net confirms) | About to go to ShipEdge |
| `processing` | Order accepted by ShipEdge, in the warehouse queue | System (ShipEdge confirms) or Admin (invoices offline order) | Warehouse team is picking & packing |
| `shipped` | Shipping label created, package handed to carrier | ShipEdge webhook or 5-minute sync fallback | Customer receives shipping notification email |
| `delivered` | Carrier confirms delivery | ShipEdge webhook or 5-minute sync fallback | Order complete |
| `cancelled` | Order cancelled | Admin (manual) or System (auto-cancel for Check/Wire) | No further action |

---

## How Statuses Appear in HubSpot

The SCW Commerce status is mapped to HubSpot Ecommerce Order status:

| SCW Commerce Status | HubSpot `eo_status` | Notes |
|---|---|---|
| `pending` | `pending` | Brief transitional state |
| `pending_payment` | `pending` | **This is the one admins will see for offline orders** |
| `paid` | `processing` | Mapped because HubSpot doesn't have a `paid` option |
| `authorized` | `processing` | Same mapping |
| `processing` | `processing` | Direct match |
| `shipped` | `shipped` | Direct match |
| `delivered` | `delivered` | Direct match |
| `cancelled` | `cancelled` | Direct match |

**When the HubSpot Ecommerce Order is created**

- **Credit Card orders** — the Ecommerce Order is enqueued after payment is approved. HubSpot displays local `paid` and `authorized` as `processing` because HubSpot has no separate paid/auth-only order status; ShipEdge acceptance then moves the local order to `processing`.
- **Offline orders (Check, ACH / Wire, Purchase Order)** — the Ecommerce Order is created at checkout with status `pending`, and updates to `processing` after the admin invoices.

> [SCREENSHOT: Ecommerce Orders list in HubSpot showing different statuses]

---

## Status Transitions — What Triggers Each Change

### Credit Card Flow — Auth & Capture (Default)

The standard credit card path. Payment is authorized and captured in one step at checkout.

<section class="modern-flow" aria-label="Credit card auth and capture flow">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Credit card default</span>
      <span class="modern-flow__title">Payment is captured automatically and the order moves straight to fulfillment</span>
    </div>
    <span class="modern-flow__badge">Automatic</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">pending<small>Order created</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">paid<small>Authorize.net approved</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">processing<small>ShipEdge accepts order</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">shipped<small>Label created</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--done">delivered<small>Carrier confirms delivery</small></span>
  </div>
</section>

| Transition | Trigger | Timing |
|---|---|---|
| pending → paid | Authorize.net returns approval | Instant (at checkout) |
| paid → processing | ShipEdge accepts the order | ~1 second after checkout |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships (webhook, with 5-minute fallback sync) |
| shipped → delivered | Carrier confirms delivery | When delivered (webhook, with 5-minute fallback sync) |

**No admin action required.** The entire flow is automatic.

### Credit Card Flow — Auth-Only (Admin Captures Later)

Used when an order should be authorized at checkout but not charged until an admin reviews it — for example a high-value order or one that needs internal approval. The customer's card has the amount on hold but no money moves until the admin captures.

<section class="modern-flow" aria-label="Credit card auth-only flow">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Auth-only</span>
      <span class="modern-flow__title">Admin captures the held card authorization before fulfillment begins</span>
    </div>
    <span class="modern-flow__badge">Manual capture</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">pending<small>Order created</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--wait">authorized<small>Card held, not charged</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Admin Captures<small>HubSpot action or admin API</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">paid<small>Funds captured</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">processing → shipped → delivered<small>ShipEdge fulfillment path</small></span>
  </div>
</section>

| Transition | Trigger | Timing |
|---|---|---|
| pending → authorized | Authorize.net approves the auth-only request | Instant (at checkout) |
| authorized → paid | **Admin captures the authorization** through the HubSpot action or admin API | When admin reviews and decides to charge |
| paid → processing | ShipEdge accepts the order | ~1 second after capture |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships (webhook, with 5-minute fallback sync) |
| shipped → delivered | Carrier confirms delivery | When delivered (webhook, with 5-minute fallback sync) |

**Admin action required at the `authorized → paid` step.** See [Admin Actions](admin-actions.md).

### Purchase Order (NET30) Flow

For approved B2B customers paying on NET30 terms. The order is created immediately but waits for the admin to invoice it after verifying the PO.

<section class="modern-flow" aria-label="Purchase order NET30 flow">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Purchase order</span>
      <span class="modern-flow__title">PO orders wait in pending payment until an admin invoices them</span>
    </div>
    <span class="modern-flow__badge">NET30</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--wait">pending_payment<small>PO submitted and saved</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Admin Invoices<small>PO verified against credit limit</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">processing → shipped → delivered<small>ShipEdge fulfillment path</small></span>
  </div>
</section>

| Transition | Trigger | Timing |
|---|---|---|
| pending → pending_payment | Order placed with Purchase Order method | Instant (at checkout) |
| pending_payment → processing | **Admin invoices the order** through the HubSpot action or admin API | When admin verifies the PO against the customer's credit limit |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships (webhook, with 5-minute fallback sync) |
| shipped → delivered | Carrier confirms delivery | When delivered (webhook, with 5-minute fallback sync) |

**No auto-cancellation** for PO orders — the order stays in `pending_payment` until an admin acts. See [Admin Actions](admin-actions.md) and [Credit Terms Management](credit-terms.md).

### Check / Money Order Flow

The customer mails a physical check. The order waits until the admin confirms the check has arrived and cleared.

<section class="modern-flow" aria-label="Check and money order flow">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Check / money order</span>
      <span class="modern-flow__title">Check orders ship after admin invoicing or auto-cancel after 14 days</span>
    </div>
    <span class="modern-flow__badge">14-day timer</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--wait">pending_payment<small>Waiting for check to clear</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Admin Invoices<small>Check received and cleared</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">processing → shipped → delivered<small>ShipEdge fulfillment path</small></span>
  </div>
  <div class="modern-flow__note">If no invoice action happens within 14 days, the daily auto-cancel cron moves the order to <code>cancelled</code>.</div>
</section>

| Transition | Trigger | Timing |
|---|---|---|
| pending → pending_payment | Order placed with Check / Money Order method | Instant (at checkout) |
| pending_payment → processing | **Admin invoices the order** through the HubSpot action or admin API | When admin confirms the check has cleared |
| pending_payment → cancelled | **No invoice action within 14 days** | Daily auto-cancel cron at 3 AM UTC |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships (webhook, with 5-minute fallback sync) |
| shipped → delivered | Carrier confirms delivery | When delivered (webhook, with 5-minute fallback sync) |

See [Admin Actions](admin-actions.md).

### ACH / Wire Transfer Flow

The customer sends a wire transfer. The order waits until the admin verifies the funds have landed.

<section class="modern-flow" aria-label="ACH and wire transfer flow">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">ACH / wire transfer</span>
      <span class="modern-flow__title">Wire orders ship after funds are verified or auto-cancel after 21 days</span>
    </div>
    <span class="modern-flow__badge">21-day timer</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--wait">pending_payment<small>Waiting for funds to land</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Admin Invoices<small>Incoming wire matched to order</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">processing → shipped → delivered<small>ShipEdge fulfillment path</small></span>
  </div>
  <div class="modern-flow__note">If no invoice action happens within 21 days, the daily auto-cancel cron moves the order to <code>cancelled</code>.</div>
</section>

| Transition | Trigger | Timing |
|---|---|---|
| pending → pending_payment | Order placed with ACH / Wire Transfer method | Instant (at checkout) |
| pending_payment → processing | **Admin invoices the order** through the HubSpot action or admin API | When admin matches the incoming wire to the order |
| pending_payment → cancelled | **No invoice action within 21 days** | Daily auto-cancel cron at 3 AM UTC |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships (webhook, with 5-minute fallback sync) |
| shipped → delivered | Carrier confirms delivery | When delivered (webhook, with 5-minute fallback sync) |

**Why 21 days instead of 14?** Wire transfers — especially international — can take longer to settle. See [Admin Actions](admin-actions.md).

### Auto-Cancellation

| Order Type | Auto-Cancel After | What Happens |
|---|---|---|
| Check / Money Order | **14 days** in `pending_payment` | Status → `cancelled`; no ShipEdge order exists because the order was not invoiced |
| ACH / Wire Transfer | **21 days** in `pending_payment` | Status → `cancelled`; no ShipEdge order exists because the order was not invoiced |
| Purchase Order (NET30) | **Never** | Stays in `pending_payment` until admin acts |
| Credit Card | **Never** | Payment is immediate |

The auto-cancel process runs daily at 3 AM UTC.

### Cancellation Paths — Who Can Cancel and When

| How an order gets cancelled | Who triggers it | When it can happen |
|---|---|---|
| **Manual cancel / correction** | Internal admin or engineering update | Any time before delivery — from `pending`, `pending_payment`, `authorized`, `paid`, `processing`, or `shipped` |
| **Auto-cancel — Check / Money Order** | System (daily cron at 3 AM UTC) | After **14 days** in `pending_payment` |
| **Auto-cancel — ACH / Wire Transfer** | System (daily cron at 3 AM UTC) | After **21 days** in `pending_payment` |
| **No auto-cancel** | — | Credit Card orders (payment is immediate) and Purchase Order (NET30) orders (no time limit; waits for admin) |

A cancelled order stays in HubSpot for reference. If the order had already been pushed to ShipEdge, the warehouse/admin team must also cancel or stop fulfillment in ShipEdge.

### Refunds and Order Status

Full refunds created through the refund APIs attempt to move the order to `cancelled` after the refund is processed. Partial and per-item refunds do **not** automatically change the order status; the admin decides whether any separate order correction is needed. Refunds are issued from the Refund Manager flow on the Ecommerce Invoice. See [Refunds & Credit Memos](refunds.md).

---

## Admin Action Reference

Admin payment actions are performed from the HubSpot action card when it is deployed, or by calling the SCW Commerce admin API directly. SCW Commerce updates the database, talks to Authorize.net / ShipEdge / email, and HubSpot records the result on the related Ecommerce object.

| Admin action | Where to click | Status transition | Side effects |
|---|---|---|---|
| **Convert quote to order** | Quote Builder card on the Ecommerce Quote record | Creates a new order: `pending` (Credit Card) or `pending_payment` (offline) | HubSpot Ecommerce Order created; payment link generated for the customer |
| **Invoice offline order** | HubSpot action card or direct admin API | `pending_payment` → `processing` | SCW Commerce creates the invoice and pushes the order to ShipEdge; HubSpot Ecommerce Invoice record created |
| **Capture auth-only credit card** | HubSpot action card or direct admin API | `authorized` → `paid` | Authorize.net captures the held funds; SCW Commerce creates the invoice and pushes the order to ShipEdge |
| **Cancel order** | Internal admin / engineering action | Any pre-delivery status → `cancelled` | SCW Commerce updates the local order and HubSpot status; ShipEdge cancellation is separate if fulfillment already started |
| **Issue refund (full / partial / per-item)** | Refund Manager card on the Ecommerce Invoice record | Full refund → `cancelled`; partial/per-item → no automatic order status change | SCW Commerce processes the refund via Authorize.net or the offline refund path, creates a refund record, syncs a HubSpot Credit Memo, and marks the local invoice `refunded` when the invoice is fully refunded |

> [SCREENSHOT: HubSpot order action card on an Ecommerce Order showing Invoice and Capture actions]

> [SCREENSHOT: HubSpot Refund Manager card on an Ecommerce Invoice record]

---

## Where to See Order Status

### In HubSpot
- Navigate to **Ecommerce Orders** in the top navigation
- The **Status** column shows the current status
- Click any order to see full details

> [SCREENSHOT: HubSpot Ecommerce Orders list view with Status column]

### In Customer's Account (Storefront)
- Customer logs in at `hubspot.getscw.com/account`
- Click **My Orders**
- Status column shows: Processing, Shipped, Delivered, Cancelled, etc.

> [SCREENSHOT: Customer's My Orders page showing order statuses]

### In the Database (Technical)
- `orders` table → `status` column
- `orders` table → `payment_method` column (credit_card, purchase_order, check, ach_wire)
- `orders` table → `po_number` column (for PO orders)
