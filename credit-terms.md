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

---

## Tax Exemptions

### Overview

Tax exemptions allow qualifying B2B customers to check out without paying sales tax in states where they hold a valid exemption. Common exempt customer types include wholesale/reseller businesses, government entities, and non-profit organizations. Exemptions are managed in HubSpot and synced to TaxJar, which applies $0 tax automatically during checkout.

---

### Setting Up a Tax-Exempt Customer in HubSpot

1. Open the customer's **Contact record** in HubSpot
2. Find the **"Tax Exemption Type"** property and set it to one of:
   - `Non-Exempt` — Default, pays sales tax (no certificate required)
   - `Wholesale` — Resellers buying for resale (needs a resale certificate on file)
   - `Government` — Gov agencies, public schools, public universities (needs an exemption cert / PO)
   - `Other` — 501(c)(3) nonprofits, churches, diplomats, qualifying manufacturers (needs the specific exemption cert)
3. Set **"Tax Exempt Regions"** — this is now a **multi-select dropdown** listing all 29 SCW nexus states. Tick every state where the customer holds a valid certificate.
   - **Leave all boxes UNCHECKED** to exempt the customer in **every nexus state** (blanket exemption).
   - **Tick specific states** for partial exemption (e.g., a wholesaler with a KY cert but not NC → tick only Kentucky → they'll pay NC tax).
4. Save the Contact.

> **Warning:** Never flip a contact to an exempt type without a valid exemption certificate on file. If the customer is audited, SCW pays the unpaid tax.

> **Note:** If these properties aren't in the default Contact view, click **"View all properties"** and search "tax exempt", or pin them via *About this contact → Actions → Edit default properties*.

---

### How the Sync Works

Two sync paths run HubSpot → SCW Commerce → TaxJar:

| Property change | Path | Latency | Requires HubSpot subscription |
|---|---|---|---|
| `email`, `firstname`, `lastname`, `approved_for_credit_terms`, `credit_limit` | Real-time webhook (`POST /api/webhooks/hubspot/contact`) | 2–3 seconds | ✅ already subscribed |
| `tax_exemption_type`, `tax_exempt_regions` | Real-time webhook (same endpoint) | 2–3 seconds | ⚠️ **subscription must be added** in HubSpot — see *Viewing & Editing Webhook Subscriptions* in [Customer Accounts](customer-accounts.md#viewing--editing-webhook-subscriptions). Without it, only the daily cron below will sync these. |
| Any of the above (fallback / reconciliation) | Daily cron at 2 AM UTC (≈ 6 AM Tbilisi / 10 PM ET) | Up to 24 hours | — |

The cron (`GET /api/cron/sync-tax-exemptions`):

1. Reads `tax_exemption_type` and `tax_exempt_regions` from HubSpot for every linked customer
2. Updates `customers.exemption_type` / `customers.exempt_regions` in the SCW Commerce database
3. For any customer whose exemption changed and is not `non_exempt`, pushes the customer record to **TaxJar Customer API** (`POST /v2/customers`) — this is what makes TaxJar apply $0 tax during calculation
4. Stores the returned TaxJar customer id on `customers.taxjar_customer_id`

The sync is one-way: **HubSpot → SCW Commerce → TaxJar**. Edits made directly in TaxJar or in the SCW Commerce database will be overwritten on the next cron run.

---

### Applying Changes Immediately (Manual Sync)

If a customer needs their exemption active before the next 2 AM UTC run, an admin can trigger the cron on demand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://hubspot.getscw.com/api/cron/sync-tax-exemptions
```

This runs the same job the scheduler would run — reads HubSpot, updates the DB, pushes to TaxJar. Typical runtime: 1–5 seconds per customer × N linked contacts.

> **Note for engineering:** extending the existing HubSpot contact webhook (`POST /api/webhooks/hubspot/contact`) to handle `tax_exemption_type` and `tax_exempt_regions` property changes would make tax exemption updates real-time like the other customer profile fields. The endpoint and signature verification already exist; only the `handlePropertyChange` switch in `hubspot-webhook.service.ts` needs two new cases plus a call to `syncCustomerExemption`.

---

### What the Customer Sees

- At checkout, if the customer is exempt in the shipping destination state, sales tax shows as **$0**
- No special action is required from the customer — the exemption applies automatically
- If the customer is not exempt in the shipping state, normal tax rates apply

---

### Exemption Types

| Type | Description |
|---|---|
| `wholesale` | Wholesale or reseller customers purchasing for resale |
| `government` | Federal, state, or local government entities |
| `other` | Non-profits or other qualifying exempt organizations |

---

### Important Notes

- **Exemptions are state-specific by default.** If you tick specific states in `Tax Exempt Regions`, the customer is exempt **only** in those states. To exempt a customer in **every** SCW nexus state, leave all state boxes **unchecked**.
- **Changes take up to 24 hours** via the daily cron at 2 AM UTC. Profile properties (name, email, credit terms) sync in real-time via webhook — tax exemption properties do not, yet.
- **Customer must be linked to a HubSpot contact.** Only customers with `hubspot_contact_id` set in the SCW Commerce database are picked up by the cron. Brand-new contacts in HubSpot who have never placed an order won't have a customer row until their first order; the *next* cron run will then sync their exemption.
- **To apply immediately,** an admin can trigger the sync manually (see *Applying Changes Immediately* above).
- **Revoking an exemption** works the same way — uncheck all regions (or set `Tax Exemption Type` back to `Non-Exempt`) in HubSpot and wait for the next sync (or trigger manually).

---

### Troubleshooting — Tax Still Charged When Customer Is Marked Exempt

If a quote or order is still charging tax for a customer you set as exempt, work through these in order:

1. **Is the exempt region the same as the ship-to state?**
   - A customer exempt only in TN (ticked Tennessee) will still pay IL tax on an IL order. This is correct behavior.
   - Fix: uncheck the restrictive state(s) for a blanket exemption, or add the ship-to state.

2. **Has the sync actually run since the HubSpot edit?**
   - Check `customers.exemption_type` in the SCW Commerce database by email:
     ```sql
     SELECT id, email, exemption_type, exempt_regions, taxjar_customer_id
     FROM customers WHERE email = '<customer-email>';
     ```
   - If `exemption_type` is still `non_exempt` → the cron hasn't run since the edit. Trigger it manually or wait for the next run.
   - If `taxjar_customer_id` is empty → the TaxJar customer record was never created. The cron creates it only when the exemption changes to non-`non_exempt`. Manually trigger after setting the exemption type.

3. **Are you on staging with sandbox TaxJar?**
   - Sandbox and production TaxJar have **separate customer records**. A customer synced to prod TaxJar does **not** exist in sandbox TaxJar. The manual cron trigger creates/updates whichever environment staging is currently pointed at.

4. **Is the customer linked to a HubSpot contact?**
   - The cron only pulls for customers with a `hubspot_contact_id`. Brand-new HubSpot contacts who've never ordered won't have a customer row yet.

---

### Complete System Flow

Here is the full end-to-end flow of how tax exemptions work across all three systems:

```
HUBSPOT (Sales Rep manages)
  Contact Properties:
    ├── tax_exemption_type: wholesale / government / other / non_exempt
    └── tax_exempt_regions: multi-select of 29 nexus states
                            (empty = exempt in all nexus states)
        │
        ▼  Daily cron (2 AM UTC)
        
SCW COMMERCE DATABASE (local storage)
  customers table:
    ├── exemption_type: varchar(30)       — "wholesale" / "government" / "other" / "non_exempt"
    ├── exempt_regions: text              — comma-separated codes, e.g. "CA,NY,TX" (NULL = all states)
    └── taxjar_customer_id: varchar(50)   — populated on first successful TaxJar sync
        │
        ▼  Same cron pushes changes to TaxJar
        
TAXJAR CUSTOMER API (tax engine)
  POST/PUT /v2/customers/{id}
    ├── exemption_type: "wholesale"
    ├── exempt_regions: [{country: "US", state: "CA"}, ...]   (omitted if all states)
    └── customer_id: "3419"
        │
        ▼  At checkout
        
TAX CALCULATION
  POST /v2/taxes
    ├── customer_id: "3419"  ← TaxJar looks up exemption
    ├── to_state: "CA"       ← checks if exempt in this state
    └── Returns: amount_to_collect: 0.00  ← $0 tax!
```

---

### How Tax Calculation Works at Checkout

When a customer reaches checkout and enters a shipping address, the system:

1. **Checks nexus** — Does SCW have a sales tax obligation in that state? SCW has nexus in 29 states. If no nexus, tax is always $0 (no API call needed).

2. **Builds the request** — Sends to TaxJar:
   - **From address:** SCW warehouse in Asheville, NC
   - **To address:** Customer's shipping address
   - **Line items:** Each product with quantity, price, and product tax code
   - **Shipping amount:** After discounts
   - **Customer ID:** Links to the customer's TaxJar exemption record

3. **TaxJar processes** — For each line item, TaxJar:
   - Looks up the customer's exemption type and exempt regions
   - Checks if the product tax code has state-specific rules
   - Calculates tax by jurisdiction (state, county, city, special district)
   - Returns $0 for exempt items/states

4. **Tax is displayed** — The checkout shows the total tax. Exempt customers see $0 in their exempt states.

---

### Product Tax Codes

Most SCW products are standard taxable goods. However, some product types are taxed differently by state:

| Product Type | Tax Code | Examples | Tax Treatment |
|---|---|---|---|
| **Hardware** (cameras, NVRs, cables) | Default | All cameras, recorders, accessories | Standard sales tax in all nexus states |
| **SaaS / Software Licensing** | `30070` | SCW AI Licenses, OpenPath Licenses, VSAAS Cloud | Some states exempt software; others tax at reduced rates |
| **Installation Services** | `10040` | (Not currently sold online) | Service tax rules vary by state |

Product tax codes are automatically mapped from the product's `tax_class_id` field. No manual configuration is needed — the system handles this at checkout.

---

### SCW Nexus States (29 states)

SCW is registered to collect sales tax in these states:

```
AK  AZ  CA  CO  FL  GA  HI  ID  IL  IN
KS  KY  LA  MA  MD  MI  MO  NC  ND  NJ
OH  OK  PA  SC  TN  TX  VA  WA  WI
```

Orders shipping to states **not** on this list are never taxed, regardless of exemption status.

---

### Current Exempt Customer Data

The system was seeded with **599 exempt customers** migrated from the previous Magento 2 platform:

| Exemption Type | Count |
|---|---|
| Wholesale | 558 |
| Other | 31 |
| Government | 10 |

Each customer has their exempt regions (specific US states) already configured. New exemptions are managed through HubSpot going forward.

---

### Troubleshooting

**Customer says they should be tax-exempt but are seeing tax:**
1. Check the Contact in HubSpot — is `Tax Exemption Type` set?
2. Check `Tax Exempt Regions` — does it include the shipping state?
3. Check if the daily sync has run since the properties were set
4. If urgent, trigger manual sync via the cron endpoint

**Tax is $0 for a customer who shouldn't be exempt:**
1. Check the Contact in HubSpot — make sure `Tax Exemption Type` is `non_exempt` or empty
2. Verify the shipping state is in SCW's nexus list (non-nexus states always show $0)

**How to check a customer's exemption status in the database:**
An admin can verify by checking the customer's record in the SCW Commerce database for `exemption_type` and `exempt_regions` fields.
