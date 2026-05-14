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
    <strong>Cancellation path:</strong> any status except <code>delivered</code> can move to <code>cancelled</code> by manual admin cancel or auto-cancel for Check / Wire orders.
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
| `shipped` | Shipping label created, package handed to carrier | ShipEdge sync (automatic, checked every 5 minutes) | Customer receives shipping notification email |
| `delivered` | Carrier confirms delivery | ShipEdge sync (automatic) | Order complete |
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

- **Credit Card orders** — the Ecommerce Order is created only when status reaches `processing` (after ShipEdge accepts). Before that, the order exists only in SCW Commerce.
- **Offline orders (Check, ACH / Wire, Purchase Order)** — the Ecommerce Order is created at checkout with status `pending`, and updates to `processing` after the admin invoices.

> [SCREENSHOT: Ecommerce Orders list in HubSpot showing different statuses]

---

## Status Transitions — What Triggers Each Change

### Credit Card Flow — Auth & Capture (Default)

The standard credit card path. Payment is authorized and captured in one step at checkout.

```
pending → paid → processing → shipped → delivered
```

| Transition | Trigger | Timing |
|---|---|---|
| pending → paid | Authorize.net returns approval | Instant (at checkout) |
| paid → processing | ShipEdge accepts the order | ~1 second after checkout |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships (checked every 5 min) |
| shipped → delivered | Carrier confirms delivery | When delivered (checked every 5 min) |

**No admin action required.** The entire flow is automatic.

### Credit Card Flow — Auth-Only (Admin Captures Later)

Used when an order should be authorized at checkout but not charged until an admin reviews it — for example a high-value order or one that needs internal approval. The customer's card has the amount on hold but no money moves until the admin captures.

```
pending → authorized → [ADMIN CAPTURES] → paid → processing → shipped → delivered
```

| Transition | Trigger | Timing |
|---|---|---|
| pending → authorized | Authorize.net approves the auth-only request | Instant (at checkout) |
| authorized → paid | **Admin clicks Capture** in the Order Actions card in HubSpot | When admin reviews and decides to charge |
| paid → processing | ShipEdge accepts the order | ~1 second after capture |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships |
| shipped → delivered | Carrier confirms delivery | When delivered |

**Admin action required at the `authorized → paid` step.** See [Admin Actions](admin-actions.md).

### Purchase Order (NET30) Flow

For approved B2B customers paying on NET30 terms. The order is created immediately but waits for the admin to invoice it after verifying the PO.

```
pending_payment → [ADMIN INVOICES] → processing → shipped → delivered
```

| Transition | Trigger | Timing |
|---|---|---|
| pending → pending_payment | Order placed with Purchase Order method | Instant (at checkout) |
| pending_payment → processing | **Admin clicks Invoice** in the Order Actions card in HubSpot | When admin verifies the PO against the customer's credit limit |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships |
| shipped → delivered | Carrier confirms delivery | When delivered |

**No auto-cancellation** for PO orders — the order stays in `pending_payment` until an admin acts. See [Admin Actions](admin-actions.md) and [Credit Terms Management](credit-terms.md).

### Check / Money Order Flow

The customer mails a physical check. The order waits until the admin confirms the check has arrived and cleared.

```
pending_payment → [ADMIN INVOICES] → processing → shipped → delivered
                ↘
                 [14 days, no invoice] → cancelled (automatic)
```

| Transition | Trigger | Timing |
|---|---|---|
| pending → pending_payment | Order placed with Check / Money Order method | Instant (at checkout) |
| pending_payment → processing | **Admin clicks Invoice** in the Order Actions card in HubSpot | When admin confirms the check has cleared |
| pending_payment → cancelled | **No invoice action within 14 days** | Daily auto-cancel cron at 3 AM UTC |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships |
| shipped → delivered | Carrier confirms delivery | When delivered |

See [Admin Actions](admin-actions.md).

### ACH / Wire Transfer Flow

The customer sends a wire transfer. The order waits until the admin verifies the funds have landed.

```
pending_payment → [ADMIN INVOICES] → processing → shipped → delivered
                ↘
                 [21 days, no invoice] → cancelled (automatic)
```

| Transition | Trigger | Timing |
|---|---|---|
| pending → pending_payment | Order placed with ACH / Wire Transfer method | Instant (at checkout) |
| pending_payment → processing | **Admin clicks Invoice** in the Order Actions card in HubSpot | When admin matches the incoming wire to the order |
| pending_payment → cancelled | **No invoice action within 21 days** | Daily auto-cancel cron at 3 AM UTC |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships |
| shipped → delivered | Carrier confirms delivery | When delivered |

**Why 21 days instead of 14?** Wire transfers — especially international — can take longer to settle. See [Admin Actions](admin-actions.md).

### Auto-Cancellation

| Order Type | Auto-Cancel After | What Happens |
|---|---|---|
| Check / Money Order | **14 days** in `pending_payment` | Status → `cancelled`, inventory released |
| ACH / Wire Transfer | **21 days** in `pending_payment` | Status → `cancelled`, inventory released |
| Purchase Order (NET30) | **Never** | Stays in `pending_payment` until admin acts |
| Credit Card | **Never** | Payment is immediate |

The auto-cancel process runs daily at 3 AM UTC.

### Cancellation Paths — Who Can Cancel and When

| How an order gets cancelled | Who triggers it | When it can happen |
|---|---|---|
| **Admin manual cancel** | Admin via the Order Actions card on the Ecommerce Order in HubSpot | Any time before delivery — from `pending`, `pending_payment`, `authorized`, `paid`, `processing`, or `shipped` |
| **Auto-cancel — Check / Money Order** | System (daily cron at 3 AM UTC) | After **14 days** in `pending_payment` |
| **Auto-cancel — ACH / Wire Transfer** | System (daily cron at 3 AM UTC) | After **21 days** in `pending_payment` |
| **No auto-cancel** | — | Credit Card orders (payment is immediate) and Purchase Order (NET30) orders (no time limit; waits for admin) |

A cancelled order stays in HubSpot for reference, is removed from the ShipEdge queue if it had already been pushed, and inventory is released.

### Refunds and Order Status

A refund moves the related invoice to `refunded` but **does not** change the order's status by itself. If the order should also be stopped from shipping, the admin must cancel it separately. Refunds are issued from the Refund Manager card on the Ecommerce Invoice in HubSpot. See [Refunds & Credit Memos](refunds.md).

---

## Admin Action Reference

Every admin action that changes order or payment state is performed in HubSpot via a custom card on the relevant CRM record. The HubSpot card calls SCW Commerce's admin API behind the scenes — SCW Commerce updates the database, talks to Authorize.net / ShipEdge / email, and HubSpot records the result on the related Ecommerce object.

| Admin action | Where to click | Status transition | Side effects |
|---|---|---|---|
| **Convert quote to order** | Quote Builder card on the Ecommerce Quote record | Creates a new order: `pending` (Credit Card) or `pending_payment` (offline) | HubSpot Ecommerce Order created; payment link generated for the customer |
| **Invoice offline order** | Order Actions card on the Ecommerce Order record | `pending_payment` → `processing` | SCW Commerce creates the invoice and pushes the order to ShipEdge; HubSpot Ecommerce Invoice record created |
| **Capture auth-only credit card** | Order Actions card on the Ecommerce Order record | `authorized` → `paid` | Authorize.net captures the held funds; SCW Commerce creates the invoice and pushes the order to ShipEdge |
| **Cancel order** | Order Actions card on the Ecommerce Order record | Any pre-delivery status → `cancelled` | Order removed from the ShipEdge queue (if previously pushed); inventory released; HubSpot status updated |
| **Issue refund (full / partial / per-item)** | Refund Manager card on the Ecommerce Invoice record | **No change to order status** | SCW Commerce processes the refund via Authorize.net and creates a refund record; HubSpot Credit Memo created; invoice marked `refunded` |

> [SCREENSHOT: HubSpot Order Actions card on an Ecommerce Order showing Invoice, Capture, and Cancel buttons]

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
