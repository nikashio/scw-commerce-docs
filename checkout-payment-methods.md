# Checkout — Payment Methods

## Overview

SCW Commerce supports four payment methods at checkout. The available methods depend on the customer's account settings.

| Payment Method | Available To | Payment Collected At Checkout? | Ships Immediately? |
|---|---|---|---|
| **Credit Card** | All customers | Yes — charged via Authorize.net | Yes — sent to ShipEdge automatically |
| **Purchase Order (NET30)** | Approved B2B customers only | No — invoiced later by admin | No — ships after admin invoices |
| **Check / Money Order** | All customers | No — mailed by customer | No — ships after check clears |
| **ACH / Wire Transfer** | All customers | No — wired by customer | No — ships after admin verifies funds |

> [SCREENSHOT: Checkout page showing all 4 payment methods (logged in as approved customer)]

---

## Credit Card

The standard payment method. Available to all customers.

### Customer Experience
1. Customer selects **Credit Card**
2. Card form appears (Card Number, MM/YY, CVV)
3. Card details are tokenized via Accept.js — **they never touch SCW servers**
4. Customer clicks **Place Order**
5. Payment is charged immediately via Authorize.net
6. Order confirmation email is sent

### What Happens in the System

| Step | SCW Commerce DB | HubSpot | ShipEdge |
|---|---|---|---|
| Order placed | Order created: `status = pending` | — | — |
| Payment processed | Status → `paid` | — | — |
| ShipEdge accepts | Status → `processing` | Ecommerce Order created: `status = processing` | Order received in queue |
| Warehouse ships | Status → `shipped` | Status → `shipped` | Tracking number created |
| Carrier delivers | Status → `delivered` | Status → `delivered` | — |
| Admin cancels (any time before delivery) | Status → `cancelled` | Status → `cancelled` | Order removed from queue |

> [SCREENSHOT: Credit card form at checkout]

### Auth-Only Mode (Manual Capture)

For some orders — typically high-value ones or ones that need internal review — the card is **authorized but not charged** at checkout. The customer's card has the amount on hold but no money moves until an admin captures it from the Order Actions card on the Ecommerce Order in HubSpot.

This is an admin-initiated mode; it is not a customer choice at checkout.

| Step | SCW Commerce DB | HubSpot | ShipEdge |
|---|---|---|---|
| Order placed | Order created: `status = authorized`, card authorization held | — | — |
| Admin captures (Order Actions card, see [Admin Actions](admin-actions.md)) | Status → `paid`, Invoice created | Ecommerce Order created: `status = processing` | Order pushed to ShipEdge |
| ShipEdge accepts | Status → `processing` | Status → `processing` | Order received in queue |
| Warehouse ships | Status → `shipped` | Status → `shipped` | Tracking number created |
| Carrier delivers | Status → `delivered` | Status → `delivered` | — |
| Admin cancels (any time before delivery) | Status → `cancelled` | Status → `cancelled` | Order removed from queue |

See [Order Lifecycle](order-lifecycle.md) for the full auth-only status flow.

---

## Purchase Order (NET30)

For pre-approved B2B customers only. The customer buys now and pays within 30 days.

### Who Can See This Option

Only customers with **"Approved for Credit Terms"** set to **Yes** on their HubSpot Contact record. See [Credit Terms Management](credit-terms.md) for how to approve a customer.

If the customer is not approved, this option is hidden — they only see Credit Card, Check, and Wire.

### Customer Experience
1. Customer selects **Purchase Order (NET30)**
2. A required **Purchase Order Number** field appears
3. Customer enters their company's PO reference (e.g., `PO-2026-0412`)
4. A note explains: *"This order is subject to NET30 terms and will be reviewed by our admin team. Your order will be processed once the PO is verified against your credit limit."*
5. Customer clicks **Submit Purchase Order**
6. Confirmation email sent with PO details and "pending review" message

> [SCREENSHOT: Purchase Order form showing PO Number field and NET30 note]

### What Happens in the System

| Step | SCW Commerce DB | HubSpot | ShipEdge |
|---|---|---|---|
| Order placed | Order created: `status = pending_payment`, `payment_method = purchase_order`, `po_number = PO-2026-0412` | Ecommerce Order created: `status = pending`, `eo_payment_method_type = purchase_order`, `eo_po_number = PO-2026-0412` | **Nothing** — order is NOT sent to ShipEdge |
| Admin invoices (see [Admin Actions](admin-actions.md)) | Status → `processing`, Invoice created | Status → `processing` | Order pushed to ShipEdge |
| Warehouse ships | Status → `shipped` | Status → `shipped` | Tracking number created |
| Carrier delivers | Status → `delivered` | Status → `delivered` | — |
| Admin cancels (any time before delivery) | Status → `cancelled` | Status → `cancelled` | Order removed from queue |

> [SCREENSHOT: Ecommerce Order in HubSpot showing Payment Method Type = Purchase Order and PO Number]

### Important
- No payment is collected at checkout
- The order will **not** ship until an admin invoices it
- The PO Number is visible on the Ecommerce Order in HubSpot for admin reference
- There is **no automatic cancellation** for PO orders — they stay in Pending Payment until the admin acts

---

## Check / Money Order

Available to all customers. The customer mails a physical check.

### Customer Experience
1. Customer selects **Check / Money Order**
2. Payment instructions appear:
   - **Payable To:** Security Camera Warehouse
   - **Mail To:** 11 Richland Street, Asheville, NC 28806
   - Reference your Order # on the check
   - Warning: *"Your order will only ship once the check has been received and cleared. If a check is not received within 14 days, the order will be automatically canceled."*
3. Customer clicks **Place Order**
4. Two emails sent:
   - Order confirmation
   - Payment instructions email reiterating mailing address and 14-day policy

> [SCREENSHOT: Check/Money Order instructions at checkout]

### What Happens in the System

| Step | SCW Commerce DB | HubSpot | ShipEdge |
|---|---|---|---|
| Order placed | Order created: `status = pending_payment`, `payment_method = check` | Ecommerce Order created: `status = pending`, `eo_payment_method_type = check` | **Nothing** |
| Check received — admin invoices (see [Admin Actions](admin-actions.md)) | Status → `processing`, Invoice created | Status → `processing` | Order pushed to ShipEdge |
| **14 days pass without invoice** | **Status → `cancelled` (automatic)** | **Status → `cancelled`** | — |
| Warehouse ships (if invoiced) | Status → `shipped` | Status → `shipped` | Tracking number created |
| Carrier delivers | Status → `delivered` | Status → `delivered` | — |
| Admin cancels (any time before delivery) | Status → `cancelled` | Status → `cancelled` | Order removed from queue |

> [SCREENSHOT: Payment instruction email for Check order]

### Important
- **14-day auto-cancel:** A daily automated process runs at 3 AM UTC and cancels any Check orders still in "Pending Payment" after 14 days. This releases the inventory.
- If the check arrives late but before auto-cancel, the admin should invoice the order promptly.
- If the admin needs more time (e.g., check arrived but hasn't cleared), they can manually move the order to "Processing" to prevent auto-cancellation.

---

## ACH / Wire Transfer

Available to all customers. The customer sends a wire transfer.

### Customer Experience
1. Customer selects **ACH / Wire Transfer**
2. Instructions appear:
   - *"Bank details (routing and account numbers) will be sent via email immediately after your order is placed."*
   - *"Please include your Order # in the transfer memo."*
   - *"To speed up processing, email a remittance advice or transfer confirmation to your sales representative."*
   - Warning: *"Your order will only ship once funds have been verified by our team."*
3. Customer clicks **Place Order**
4. Two emails sent:
   - Order confirmation
   - **Bank details email** containing routing number, account number, and account name

> [SCREENSHOT: ACH/Wire Transfer instructions at checkout]

### What Happens in the System

| Step | SCW Commerce DB | HubSpot | ShipEdge |
|---|---|---|---|
| Order placed | Order created: `status = pending_payment`, `payment_method = ach_wire` | Ecommerce Order created: `status = pending`, `eo_payment_method_type = ach_wire` | **Nothing** |
| Admin verifies funds — invoices (see [Admin Actions](admin-actions.md)) | Status → `processing`, Invoice created | Status → `processing` | Order pushed to ShipEdge |
| **21 days pass without invoice** | **Status → `cancelled` (automatic)** | **Status → `cancelled`** | — |
| Warehouse ships (if invoiced) | Status → `shipped` | Status → `shipped` | Tracking number created |
| Carrier delivers | Status → `delivered` | Status → `delivered` | — |
| Admin cancels (any time before delivery) | Status → `cancelled` | Status → `cancelled` | Order removed from queue |

> [SCREENSHOT: Bank details payment instruction email]

### Important
- **21-day auto-cancel:** Wire orders are automatically canceled after 21 days if not invoiced (longer than Check because wire transfers can take more time internationally).
- Bank details are sent via email (not shown on the checkout success page) for security — the customer has a permanent record for their finance department.
- The admin should monitor the bank portal for incoming transfers and match them by Order # in the memo field.
- Once funds are confirmed, the admin invoices the order to trigger fulfillment.

---

## Payment Methods at a Glance

<section class="method-glance" aria-label="Payment methods at a glance">
  <div class="method-glance__header">
    <div>
      <span class="method-glance__eyebrow">Customer at checkout</span>
      <span class="method-glance__title">Each payment method decides when payment is collected and when ShipEdge receives the order</span>
    </div>
    <span class="method-glance__badge">4 methods</span>
  </div>
  <div class="method-glance__grid">
    <article class="method-glance__card">
      <h4>Credit Card</h4>
      <div class="method-glance__path">
        <div class="method-glance__step">Payment charged<small>Authorize.net captures payment at checkout</small></div>
        <div class="method-glance__step">Order: Processing<small>ShipEdge receives the order automatically</small></div>
        <div class="method-glance__step">Ships<small>Warehouse ships and tracking syncs back</small></div>
      </div>
    </article>
    <article class="method-glance__card">
      <h4>Purchase Order</h4>
      <div class="method-glance__path">
        <div class="method-glance__step">No payment<small>NET30 approved customers only; PO # saved</small></div>
        <div class="method-glance__step">Order: Pending Payment<small>Waits for admin review</small></div>
        <div class="method-glance__step">Admin invoices → ShipEdge → Ships<small>No automatic cancellation</small></div>
      </div>
    </article>
    <article class="method-glance__card">
      <h4>Check</h4>
      <div class="method-glance__path">
        <div class="method-glance__step">No payment<small>Mailing instructions shown and emailed</small></div>
        <div class="method-glance__step">Order: Pending Payment<small>Waits for admin to invoice after check clears</small></div>
        <div class="method-glance__step">Admin invoices → ShipEdge → Ships<small>Auto-cancels after 14 days if not invoiced</small></div>
      </div>
    </article>
    <article class="method-glance__card">
      <h4>ACH / Wire</h4>
      <div class="method-glance__path">
        <div class="method-glance__step">No payment<small>Bank details are emailed after checkout</small></div>
        <div class="method-glance__step">Order: Pending Payment<small>Waits for admin to verify funds</small></div>
        <div class="method-glance__step">Admin invoices → ShipEdge → Ships<small>Auto-cancels after 21 days if not invoiced</small></div>
      </div>
    </article>
  </div>
</section>
