# Refunds & Credit Memos

## Overview

When a customer needs a refund, the process is managed entirely from HubSpot. Sales reps or admins use the **Credit Memo Card** on the Invoice record to create refunds. The system handles everything automatically: payment reversal through Authorize.net, customer email notification, TaxJar tax reporting, and HubSpot record creation.

***

## How to Issue a Refund

### Step 1: Find the Invoice

In HubSpot, navigate to the **Ecommerce Invoice** record for the order you need to refund. You can find it by:

* Going to the Ecommerce Order → clicking the associated Invoice in the sidebar
* Or searching Ecommerce Invoices directly

### Step 2: Open the Credit Memo Card

![The Refund Manager card on a HubSpot Ecommerce Invoice record — invoice total / total refunded / refundable amounts, payment details, and the Create Refund button (this check-paid invoice shows the offline-payment refund notice)](.gitbook/assets/hubspot-credit-memo-card.png)

_The Refund Manager card on a HubSpot Ecommerce Invoice record — invoice total / total refunded / refundable amounts, payment details, and the Create Refund button (this check-paid invoice shows the offline-payment refund notice)_

On the Invoice record, click the **Credit Memo** tab. This shows:

* Invoice details (line items, totals)
* Authorize.net transaction status
* Any existing credit memos for this invoice

### Step 3: Choose Refund Type

| Type                        | When to Use                          | What Happens                                            |
| --------------------------- | ------------------------------------ | ------------------------------------------------------- |
| **Full Refund**             | Customer wants everything back       | Refunds entire invoice amount. Order status → Cancelled |
| **Partial (Dollar Amount)** | Goodwill credit, price match, etc.   | Refunds a custom dollar amount you specify              |
| **Per Item**                | Customer returning specific products | Select items and quantities to refund                   |

### Step 4: Submit

1. Select the refund type
2. Enter the reason (required)
3. For partial: enter the dollar amount
4. For per-item: select items and quantities
5. Click **Create Refund**

The system will:

1. Process the payment reversal through Authorize.net (credit card) or mark as offline refund (check/wire/PO)
2. Enqueue a HubSpot Credit Memo creation on the `hubspot_outbox` — delivered within \~1 minute with automatic retry on failure
3. Send a refund confirmation email to the customer
4. Report the refund to TaxJar as a negative transaction (with proportional tax)
5. Update the local invoice status to `refunded` if the invoice is fully refunded. HubSpot's Ecommerce Invoice enum has no refunded state, so the Credit Memo is the refund record there.
6. Update the order status to `cancelled` for full refunds. Partial and per-item refunds do not change order status automatically.

**Double-click safe:** Every refund request carries an idempotency key. If the card is clicked twice or the Lambda retries, SCW returns the existing refund instead of creating a duplicate. No risk of the customer being refunded twice.

**Honest retry results:** a retry only shows success if the original refund actually went through (`processed` / `pending_settlement`). If the earlier attempt **failed at the payment gateway**, the retry returns an explicit error ("previous refund attempt failed") instead of a false success, and the card resets so the admin can deliberately submit a fresh refund. If the earlier attempt is still in flight, the card says so and asks the admin to refresh rather than double-submit.

***

## Refund Types Explained

### Full Refund

Refunds the entire invoice amount. The order moves to **Cancelled** status and is no longer eligible for fulfillment.

* **Use when:** Customer cancels the entire order, or the order can't be fulfilled
* **Payment:** Full amount returned to original payment method
* **Order status:** → Cancelled
* **Requires a clean invoice:** A full refund is only allowed when the invoice has no prior refunds. If the invoice has already been partially refunded, the system rejects the full refund — use a **Partial (Custom Amount)** or **Per-Item** refund for the remaining balance instead.

### Partial Refund (Custom Amount)

Refunds a specific dollar amount, up to the invoice total.

* **Use when:** Price adjustment, goodwill credit, shipping refund, damage discount
* **Payment:** Specified amount returned to original payment method
* **Order status:** No automatic change (admin decides)
* **The customer receives exactly what you enter:** the refund total is `amount + shipping refund − restocking fee`, to the cent — the same figure shown on the card before you confirm. Internally SCW splits that gross into a pre-tax base and its embedded tax (at the invoice's tax ratio) so TaxJar is reported the correct sales tax, without changing the customer's total.
* A restocking fee that equals or exceeds the refund gross is rejected — a refund must always be a positive amount.

### Per-Item Refund

Refunds specific line items by selecting products and quantities.

* **Use when:** Customer returns specific items from a multi-item order
* **Payment:** Calculated total for selected items returned
* **Order status:** No automatic change (admin decides)
* **Quantity is the money lever:** each line refunds `quantity × invoice unit price`; the Amount column is display-only. Proportional tax is added on top of the goods + shipping being refunded, and per-line restocking percentages are summed into a single deduction.

> **Full refunds take no adjustments:** shipping-refund and restocking-fee fields don't apply to a full refund (it returns the entire invoice, shipping included) and are rejected server-side if supplied.

***

## How Payment Reversal Works

The system automatically determines the correct payment reversal method:

| Transaction State                            | Method     | What Happens                                                                       |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| **Unsettled** (auth\_only, same-day capture) | **Void**   | Transaction is cancelled before it settles. Funds are released immediately.        |
| **Settled** (captured, next business day+)   | **Refund** | A new refund transaction is created. Funds typically appear in 5-10 business days. |

The system checks the original payment's transaction type:

* `auth_only` → Void
* `auth_capture` or `capture` → Refund

It then verifies settlement: if a captured transaction has not yet settled at Authorize.net, the refund is automatically routed to a **Void** instead — but only for a full refund (a void is all-or-nothing). A **partial** refund against a captured-but-unsettled transaction is blocked; the operator must wait until after the daily Authorize.net settlement batch and retry.

No manual decision is needed for the void-vs-refund choice — the system handles it automatically.

### When a Refund Is Blocked

A few conditions cause the refund to fail up front (before any money moves) and ask the operator to act:

| Condition                                                     | What the operator sees                                                                                                    | What to do                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Partial refund on an uncaptured `auth_only` authorization** | Refund fails — a void is all-or-nothing, so a partial amount can't be voided                                              | Capture the payment first, then issue the partial refund (or void the full amount) |
| **Partial refund on a captured-but-unsettled transaction**    | Refund fails — Authorize.net won't issue a partial credit until the charge settles                                        | Wait until after the next daily Authorize.net settlement batch, then retry         |
| **Refund total exceeds the original captured amount**         | Refund fails at the gateway boundary (e.g. inflated by shipping/restocking)                                               | Lower the refund total so it does not exceed what was actually captured            |
| **Card last-4 missing for a settled refund**                  | The system backfills it from the Authorize.net transaction-details lookup; only fails if both the DB and Auth.net lack it | Contact support if it still can't be resolved                                      |

Refund creation is also concurrency-safe: the invoice row is locked while a refund is created, so two simultaneous refunds on the same invoice cannot over-refund it.

***

## What the Customer Receives

> \[SCREENSHOT: The refund confirmation / credit memo email showing refund number, refund amount, refunded items, billing/shipping addresses, and the 5-10 business days note — images/refunds-customer-email.png]

When a refund is processed, the customer receives an email with:

* Refund number (e.g., RFD-000001)
* Refund amount
* Refunded items (for per-item refunds)
* Original billing and shipping addresses
* Note about 5-10 business days for the refund to appear

***

## Refund Status Flow

Refund lifecycle Refunds process automatically, record offline credits, or retry after failureCredit MemoPendingRefund created ApprovedValidated and ready ProcessedPayment reversed and email sentOffline cash refundOperational payoutCheck or wire handled by finance ProcessedCredit memo recorded in SCWRetry pathFailedPayment gateway error PendingRetry from pending

| Status                 | Meaning                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pending**            | Refund created, awaiting processing                                                                                                                                |
| **Approved**           | Validated, ready to execute payment reversal                                                                                                                       |
| **Pending Settlement** | Supported state for a manually staged offline refund. HubSpot-created offline refunds currently skip this and process immediately when the credit memo is created. |
| **Processed**          | Payment reversed or offline credit recorded, email sent, complete. HubSpot Credit Memo enqueued for sync.                                                          |
| **Failed**             | Payment gateway error — can be retried                                                                                                                             |

In practice, when initiated from HubSpot:

* **Credit-card refunds**: Pending → Approved → Processed automatically in one step.
* **Offline cash refunds** (check / wire): Pending → Approved → Processed immediately when the admin creates the credit memo. Create it only after the offline payout is approved/issued operationally.
* **Offline credit memos** (PO / NET30): Pending → Approved → Processed (no payout, just reduces A/R).

***

## What Gets Created in HubSpot

![A HubSpot Ecommerce Credit Memo record showing the Refund Manager card on the parent Invoice (INVOICE TOTAL, TOTAL REFUNDED, REFUNDABLE amounts), the Credit Memos section in the right sidebar with Refunded status, and the associated Ecommerce Order.](.gitbook/assets/hubspot-credit-memo-record.png)

_The Ecommerce Invoice with the Credit Memos association — each refund creates a Credit Memo record linked to the Invoice, Order, and Contact._

When a refund is processed, a **Credit Memo** record is created with:

| Property       | Description                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| Credit Memo ID | Refund number from SCW Commerce (e.g., RFD-000001)                                |
| Status         | `refunded` (or `pending` when the source refund is still in `pending_settlement`) |
| Refund Type    | `full`, `per_item`, or `partial` (HubSpot enum; see note below)                   |
| Total Refund   | Dollar amount refunded                                                            |
| Reason         | Reason provided by the admin                                                      |
| Refund Date    | When the refund was processed                                                     |

> **Refund Type values:** the SCW database stores the refund type as `full`, `partial`, or `custom_amount`. HubSpot's `ecm_refund_type` property uses a different enum — SCW values are remapped before syncing: `full` → `full`, `partial` (per-item line refund) → `per_item`, `custom_amount` (custom dollar amount) → `partial`. The HubSpot enum only accepts `[full, partial, per_item]`; sending raw SCW values causes a non-retryable 400 INVALID\_OPTION.

The Credit Memo is automatically **associated** with:

* The Ecommerce Order
* The Ecommerce Invoice
* The Contact

> **How it syncs:** the SCW outbox path is gated behind the `HUBSPOT_OUTBOX_ENABLED` flag. While the flag is off (the dual-write transition state), the SCW enqueue no-ops and the HubSpot Lambda creates the memo instead. Either path is **idempotent** on `ecm_source_id = scw-<refundId>`: if a memo already exists for the refund it is reused (and its associations repaired) rather than duplicated.

***

## Tax Compliance

Every refund is automatically reported to **TaxJar** as a negative transaction. This ensures:

* Tax collected on the original order is properly reversed
* TaxJar's filing reports reflect the correct net tax for each jurisdiction
* State/county/city tax amounts are adjusted accurately

### Tax on Per-Item Refunds (proportional, added on top)

For **per-item** refunds, the system refunds tax proportional to the goods returned, added on top of the item prices. Formula:

```
taxRefund = invoice.taxAmount × (refundSubtotal + refundShipping) / (invoice.subtotal + invoice.shippingAmount)
```

Example: an invoice of $100 subtotal + $10 shipping + $7.70 tax ($117.70 total). Customer returns $50 of goods. Tax refund is `7.70 × 50 / 110 = $3.50`. The customer gets $53.50 back; TaxJar shows `-$3.50` sales tax. Without proportional math, TaxJar would see $0 refunded tax and SCW would over-remit $3.50 to the state.

### Tax on Custom-Amount Refunds (embedded in the amount)

For **partial (custom amount)** refunds, the entered amount is the gross the customer receives — tax is backed **out of** it (at the invoice's tax ratio) rather than added on top. Same invoice, $50 entered: the customer gets exactly $50.00; SCW records \~$46.73 pre-tax + \~$3.27 tax, and TaxJar shows `-$3.27` sales tax.

### Where the Refund Is Filed

The refund files to the **same jurisdiction the sale was taxed in**. For shipped orders that's the ship-to address; for **in-store pickup** orders both the sale and the refund file to the store origin (NC) — so a pickup refund reverses the NC liability rather than creating a stray credit in the customer's home state.

### Retry on Failure

If TaxJar is unreachable at the moment of refund, the report is enqueued in the DLQ. The `process-dlq` cron runs every 5 minutes and retries due items with exponential backoff — 1, 2, 4, 8, then 16 minutes between attempts, up to 5 attempts. The refund itself still succeeds — TaxJar reconciles when it comes back online.

The refund files under its **own date**, not the date the retry happens to succeed. So a report that is delayed — even one that lands in the next day or month — still books to the correct tax filing period rather than the period it was retried in. (A sale files the same way, under the date payment was collected.)

***

## Offline Payment Refunds

For orders paid via **Check/Money Order**, **ACH/Wire Transfer**, or **Purchase Order (NET30)**, the system processes refunds without calling a payment gateway.

### How It Works

When you click **Create Refund** on an invoice, the system checks the order's payment method and automatically selects the correct flow:

| Payment Method                  | Flow                | What Happens                                                                                |
| ------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| **Credit Card (Authorize.net)** | Online refund       | Funds reversed through Authorize.net automatically                                          |
| **Check / Money Order**         | Offline cash refund | Credit memo created and marked processed; finance handles the external payout operationally |
| **ACH / Wire Transfer**         | Offline cash refund | Credit memo created and marked processed; finance handles the external payout operationally |
| **Purchase Order (NET30)**      | Credit-only memo    | Credit memo created immediately — no payout needed (reduces accounts receivable)            |

### Cash Refund Flow (Check / ACH / Wire)

1. Admin creates refund from the Credit Memo card on the invoice
2. System creates a credit memo and marks it **Processed** immediately
3. Admin/finance handles the actual payout operationally (writes a check, initiates wire, etc.)
4. System sends refund confirmation email to customer and reports to TaxJar

### Credit-Only Flow (Purchase Order / NET30)

1. Admin creates refund from the Credit Memo card on the invoice
2. System creates a credit memo and marks it **Processed** immediately
3. Customer receives email confirmation
4. The credit reduces the outstanding accounts receivable — no cash payout needed

### Customer Notes

The refund form includes a **Notes to Customer** field. Use this for:

* RMA numbers
* Restocking fee explanations
* Return shipping instructions
* Approval status details

These notes are stored on the refund record (`refunds.customer_notes`) and are **included in the refund confirmation email** sent to the customer, shown as a **"Notes:"** section in the credit-memo email. They are **not** synced to the HubSpot Credit Memo object (the credit-memo property set has no notes field).

### Refund Adjustments

Both online and offline refunds support:

* **Shipping Refund** — amount of shipping to refund
* **Restocking Fee** — deducted from the refund total. There is no enforced percentage cap in code — the fee is only validated as a non-negative number; the sole constraint is that the resulting refund total must remain greater than zero.

Formula: `Refund Total = Item Subtotal + Shipping Refund + Proportional Tax − Restocking Fee`

The proportionally-refunded tax (see [Proportional Tax on Partial Refunds](refunds.md#proportional-tax-on-partial-refunds)) is included in the grand total.

***

## Limitations & Known Gaps

| Gap                                                     | Current Workaround                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **ShipEdge not auto-cancelled**                         | Admin must manually cancel fulfillment in ShipEdge if items haven't shipped                                        |
| **Partial refund doesn't update order status**          | Admin manually updates order status if needed                                                                      |
| **No customer-facing refund tracking**                  | Customer gets email confirmation but can't check refund status in their account                                    |
| **No refund reversal**                                  | Once processed, a refund cannot be undone — issue a new invoice if needed                                          |
| **No separate payout tracker for offline cash refunds** | SCW records the credit memo as processed when created; finance tracks the external check/wire payout operationally |

***

## Troubleshooting

**Refund failed with gateway error:**

* Check if the transaction has settled (void vs refund)
* Verify the original transaction ID is valid in Authorize.net
* Check if the card has expired (refunds to expired cards usually still work)
* Retry from the Credit Memo Card

**Credit Memo not showing in HubSpot:**

* Credit memos are created asynchronously via the HubSpot outbox. Delivery normally takes under a minute.
*   Check `hubspot_outbox` for the refund row:

    ```sql
    SELECT id, event_type, status, attempt_count, last_error_code, last_error_message
    FROM hubspot_outbox
    WHERE entity_type = 'refund' AND entity_id = '<refundId>';
    ```
* Status meanings:
  * `pending` / `processing` — about to deliver, check again in 1 min
  * `retrying` — HubSpot returned a transient error, will auto-retry with backoff
  * `abandoned` — non-retryable error (e.g. HubSpot 400) after 9 attempts; needs human attention. Check `last_error_message`.
  * `delivered` — successfully created in HubSpot; refresh the HubSpot record

**Customer didn't receive refund email:**

* Check the customer's email address on the order
* Check SCW Commerce logs for email sending errors
* The email is sent asynchronously — it may take a few minutes
