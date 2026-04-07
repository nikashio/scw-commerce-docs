# Credit Terms Management

## Overview

Credit Terms (Purchase Order / NET30) allow approved B2B customers to place orders without paying upfront. The approval is managed entirely in HubSpot and synced daily to the storefront.

---

## Approving a Customer for Credit Terms

### Step 1: Open the Contact in HubSpot

Navigate to the customer's Contact record in HubSpot.

> [SCREENSHOT: HubSpot Contact record]

### Step 2: Set the Properties

In the **"About this Contact"** section, find and set:

| Property | Value | Description |
|---|---|---|
| **Approved for Credit Terms** | Yes | Enables the Purchase Order payment option at checkout |
| **Credit Limit** | e.g., `50000` | Maximum credit amount in USD (informational — not enforced at checkout in V1) |

> [SCREENSHOT: Contact properties showing "Approved for Credit Terms" checkbox and "Credit Limit" field]

If you don't see these properties in the default view:
1. Click **"View all properties"** on the Contact
2. Search for "approved" or "credit"
3. Set the values
4. Optionally, click **"Actions" → "Customize properties"** to pin them to the default view

### Step 3: Wait for Sync (or Trigger Manually)

The storefront syncs credit terms from HubSpot **daily at 2 AM UTC**. After the sync:
- The customer's storefront account is updated with the approval flag
- Next time they go to checkout, the **Purchase Order (NET30)** option appears

To trigger an immediate sync (for testing or urgent approvals), an admin can call:
```
GET https://hubspot.getscw.com/api/cron/sync-credit-terms
```
with the cron authorization header.

---

## Revoking Credit Terms

To remove a customer's ability to use Purchase Orders:

1. Open their Contact in HubSpot
2. Set **"Approved for Credit Terms"** to **No**
3. Wait for the daily sync (or trigger manually)
4. The Purchase Order option will no longer appear at their checkout

> **Note:** Revoking credit terms does not affect existing orders. Any PO orders already placed will remain in their current status.

---

## What the Customer Sees

### Approved Customer (4 payment methods)

> [SCREENSHOT: Checkout showing Credit Card, Purchase Order (NET30), Check, ACH/Wire]

The Purchase Order option shows the subtitle "Subject to credit approval."

### Non-Approved Customer (3 payment methods)

> [SCREENSHOT: Checkout showing only Credit Card, Check, ACH/Wire — no Purchase Order]

The Purchase Order option is completely hidden — the customer has no way to select it.

---

## How the Sync Works (Technical)

1. A daily cron job runs at **2 AM UTC**
2. It queries all customers in the SCW Commerce database that have a `hubspot_contact_id`
3. For each customer, it fetches two properties from the HubSpot Contact:
   - `approved_for_credit_terms`
   - `credit_limit`
4. If the values differ from what's stored locally, it updates the customer record
5. The sync is one-way: **HubSpot → Storefront**. Changes made directly in the database will be overwritten by the next sync.

### Sync Summary

| Direction | What Syncs | Frequency |
|---|---|---|
| HubSpot → Storefront | `approved_for_credit_terms`, `credit_limit` | Daily at 2 AM UTC |
| Storefront → HubSpot | Nothing (one-way sync) | — |

---

## Credit Limit (Future Enhancement)

Currently, the credit limit is **informational only** — it appears on the Contact record for admin reference when reviewing PO orders. The checkout does not enforce it (a customer can place a PO order for any amount).

In a future version, the checkout could:
- Compare the order total against the credit limit
- Check outstanding unpaid PO orders against the remaining credit
- Reject PO orders that would exceed the limit

For V1, the admin uses their judgment when reviewing PO orders.
