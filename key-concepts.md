# Key Concepts

Before diving into specific workflows, it's important to understand the core objects and how they relate to each other. If you understand this page, everything else will make sense.

---

## The Core Objects

Think of the SCW Commerce system as a chain of objects that get created one after another as a sale progresses:

<section class="modern-flow" aria-label="Core commerce object chain">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Core object chain</span>
      <span class="modern-flow__title">A sale moves from customer identity to quote, order, billing, and fulfillment</span>
    </div>
    <span class="modern-flow__badge">Lifecycle</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">Contact<small>Customer identity in HubSpot</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Quote<small>Rep-built proposal</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">Order<small>Customer commits to buy</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--wait">Invoice<small>Billing record</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">Shipment<small>Fulfillment and tracking</small></span>
  </div>
</section>

Each object represents a stage in the sales lifecycle.

---

### Contact

**What it is:** A person or company that interacts with SCW. Every customer has a Contact record in HubSpot.

**Created when:** First order is placed (if the contact doesn't already exist in HubSpot).

**Key properties:**
- Name, email, phone
- Company
- Approved for Credit Terms (Yes/No)
- Credit Limit

**Where it lives:** HubSpot (primary), mirrored in SCW Commerce DB as a customer record.

> [SCREENSHOT: Contact record in HubSpot showing key properties]

---

### Ecommerce Quote

**What it is:** A price proposal built by a sales rep for a customer. Contains product line items with quantities and negotiated prices.

**Created when:** A sales rep clicks "Add" on the Ecommerce Quotes section of a Contact record and uses the Quote Builder.

**Key properties:**
- Quote ID
- Status (Draft, Saved)
- Line items (products, quantities, prices)
- Subtotal, tax, discount, total
- Customer billing and shipping address
- Payment Link (generated URL)

**Where it lives:** HubSpot only. Quotes do not exist in the SCW Commerce database.

**Relationships:**
- Linked to a **Contact** (the customer)
- Linked to **Ecommerce Line Items** (the products in the quote)
- After checkout: linked to an **Ecommerce Order**

> [SCREENSHOT: Ecommerce Quote record showing Quote Builder and sidebar relationships]

---

### Ecommerce Order

**What it is:** A confirmed purchase. Created when a customer (or rep) completes checkout.

**Created when:** Checkout is completed — either by the customer directly or by a rep on their behalf.

**Key properties:**
- Order ID (e.g., `SCW-20260406-A1B2`)
- Status (Pending, Processing, Shipped, Delivered, Cancelled)
- Payment Method Type (Credit Card, Purchase Order, Check, ACH/Wire)
- PO Number (for Purchase Order payments)
- Totals (subtotal, shipping, tax, grand total)
- Shipping and billing addresses
- Source ID (internal database ID for API calls)

**Where it lives:** SCW Commerce DB (primary), synced to HubSpot as an Ecommerce Order object.

**Relationships:**
- Linked to a **Contact**
- Linked to an **Ecommerce Quote** (if the order originated from a quote/payment link)
- Linked to **Ecommerce Line Items** (the products ordered)
- Linked to **Ecommerce Invoices** (when invoiced)
- Linked to **Ecommerce Shipments** (when shipped)

> [SCREENSHOT: Ecommerce Order record in HubSpot showing key properties and sidebar relationships]

---

### Ecommerce Invoice

**What it is:** A financial record confirming that payment has been accounted for. An invoice is the signal that an order is ready to ship.

**Created when:**
- **Credit card orders:** Automatically created at checkout (payment is immediate)
- **Offline payment orders:** Created by admin when payment is confirmed (this triggers fulfillment)

**Key properties:**
- Invoice Number
- Status (Pending, Paid, Cancelled, Refunded)
- Amount
- Payment method and transaction details

**Where it lives:** SCW Commerce DB (primary), synced to HubSpot as an Ecommerce Invoice object.

**Important:** For offline payment methods, the **invoice is the trigger for shipping**. No invoice = no shipment. When an admin "invoices" a pending payment order, the system creates the invoice AND pushes the order to ShipEdge for fulfillment.

> [SCREENSHOT: Ecommerce Invoice record in HubSpot]

---

### Ecommerce Shipment

**What it is:** A fulfillment record. Created when the warehouse creates a shipping label in ShipEdge.

**Created when:** ShipEdge fulfillment process creates a shipping label. The data syncs back to SCW Commerce through the ShipEdge webhook when configured, with the 5-minute cron as reconciliation.

**Key properties:**
- Tracking number
- Carrier (UPS)
- Shipped date
- Delivered date

**Where it lives:** ShipEdge (primary), synced to SCW Commerce DB and HubSpot.

> [SCREENSHOT: Ecommerce Shipment record in HubSpot showing tracking info]

---

## How the Objects Connect

Here's the full picture of how these objects relate to each other in HubSpot:

<section class="modern-flow" aria-label="HubSpot object relationship map">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">HubSpot object map</span>
      <span class="modern-flow__title">A Contact can own quotes and orders; the order becomes the hub for invoice and shipment records</span>
    </div>
    <span class="modern-flow__badge">Associations</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">Contact<small>John Smith<br>john@co.com</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Ecommerce Quote<small>scw-nika<br>$10,000</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">Ecommerce Order<small>SCW-0406..<br>$10,000</small></span>
  </div>
  <div class="modern-flow__branches">
    <div class="modern-flow__branch">
      <span class="modern-flow__branch-title">Quote association</span>
      <div class="modern-flow__track">
        <span class="modern-flow__node">Quote ↔ Order<small>Connects the original proposal to the resulting order</small></span>
      </div>
    </div>
    <div class="modern-flow__branch">
      <span class="modern-flow__branch-title">Fulfillment records</span>
      <div class="modern-flow__track">
        <span class="modern-flow__node modern-flow__node--wait">Ecommerce Invoice<small>INV-000012<br>$10,000</small></span>
        <span class="modern-flow__arrow" aria-hidden="true"></span>
        <span class="modern-flow__node modern-flow__node--ship">Ecommerce Shipment<small>1Z999AA1..<br>UPS Ground</small></span>
      </div>
    </div>
  </div>
</section>

> [SCREENSHOT: HubSpot sidebar of an Ecommerce Order showing all related objects — Contact, Quote, Invoice, Shipments, Line Items]

---

## Order Statuses — The Quick Reference

Every order has a status. Here's what each one means and what action (if any) is needed:

| Status | What It Means | Action Needed? |
|---|---|---|
| **Pending** | Order just created, payment being processed | No — wait (this state lasts milliseconds) |
| **Pending Payment** | Offline payment order waiting for admin | **Yes — admin must invoice when payment is confirmed** |
| **Processing** | Order is in the ShipEdge warehouse queue | No — warehouse team handles it |
| **Shipped** | Package is with the carrier, tracking available | No — customer has been notified |
| **Delivered** | Carrier confirmed delivery | No — order is complete |
| **Cancelled** | Order cancelled (manual or auto) | No — closed |

The most important status for admins is **Pending Payment** — these are the orders that require action.

---

## Payment Methods — The Quick Reference

| Method | Who Can Use It | Payment Timing | Auto-Cancel |
|---|---|---|---|
| **Credit Card** | Everyone | Charged immediately at checkout | Never |
| **Purchase Order (NET30)** | Approved B2B customers only | Customer pays within 30 days | Never (admin must act) |
| **Check / Money Order** | Everyone | Customer mails a check | **14 days** if not invoiced |
| **ACH / Wire Transfer** | Everyone | Customer sends a wire | **21 days** if not invoiced |

---

## Glossary

| Term | Definition |
|---|---|
| **Quote Builder** | The custom HubSpot card where sales reps build quotes with products, prices, and customer info |
| **Payment Link** | A URL generated from a quote that takes the customer (or rep) directly to checkout with products pre-loaded |
| **Pending Payment** | An order status meaning "we have the order but haven't received payment yet" — used for Check, Wire, and PO orders |
| **Invoice (verb)** | The admin action of confirming payment and creating an invoice record, which triggers ShipEdge fulfillment |
| **ShipEdge** | The warehouse management system where orders are fulfilled (picked, packed, shipped) |
| **Credit Terms** | The ability for a customer to buy now and pay later (NET30). Must be approved per customer in HubSpot. |
| **PO Number** | Purchase Order number — the customer's internal reference for the order, required for NET30 payments |
| **DLQ** | Dead Letter Queue — retry queue for non-outbox work such as ShipEdge order push, quote↔order association, TaxJar refund reporting, and import jobs. Runs every 5 minutes. |
| **HubSpot Outbox** | Durable sync queue for all SCW → HubSpot data flow (orders, invoices, shipments, refunds). Runs every minute with exponential-backoff retry. Replaces the old inline-sync approach — every sync event leaves an auditable row in `hubspot_outbox`. See **Platform Overview → How HubSpot Sync Works**. |
| **Ecommerce Objects** | Custom HubSpot objects (Quote, Order, Invoice, Shipment, Credit Memo, Line Item) that mirror the storefront data |
| **Idempotency Key** | A unique identifier sent with every refund/sync request so retries and duplicates return the same result instead of creating duplicate records. Protects against double-clicks and Lambda retries. |
| **Fulfillment Flags (Dropship / Preorder / Special Order)** | Per-product checkboxes in the product editor that set the availability badge on the product page: **Preorder** → "Pre Order" (*"in production and will be available soon"*); **Special Order** or **Dropship** → "Special Order" (*"ships in 3-5 business days for small orders; contact us before purchasing for large orders"*); none set → "In Stock" (*"usually ships the same business day if ordered before 2PM EST"*). **Display only** — they set customer expectations but do **not** change stock (ShipEdge owns inventory) or whether the item can be purchased. Synced to HubSpot as the `scw_is_dropship` / `scw_is_preorder` / `scw_is_special_order` product properties. |
