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
   - `Wholesale` — Wholesale or reseller customers
   - `Government` — Government entities
   - `Other` — Non-profits or other exempt types
3. Find the **"Tax Exempt Regions"** property and enter the applicable state codes as a comma-separated list (e.g., `CA,NY,TX`)
4. Save the Contact — the daily sync will pick up the changes

> **Note:** If you don't see these properties in the default Contact view, click **"View all properties"** and search for "tax exempt".

---

### How the Sync Works

1. A daily cron job reads `tax_exemption_type` and `tax_exempt_regions` from HubSpot Contacts
2. Updates the local SCW Commerce database with the latest exemption data
3. Syncs the customer's exemption to the **TaxJar Customer API**
4. TaxJar applies $0 tax automatically for exempt states during checkout

The sync is one-way: **HubSpot → SCW Commerce → TaxJar**.

| Direction | What Syncs | Frequency |
|---|---|---|
| HubSpot → Storefront | `tax_exemption_type`, `tax_exempt_regions` | Daily at 2 AM UTC |
| Storefront → TaxJar | Customer exemption record | Daily at 2 AM UTC |

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

- **Exemptions are state-specific.** A customer can be exempt in CA but fully taxed in NY. Always set the correct states in `Tax Exempt Regions`.
- **Changes take up to 24 hours.** The daily cron runs at 2 AM UTC. Plan ahead for new customers.
- **To apply immediately,** an admin can trigger the sync manually:
  ```
  GET https://hubspot.getscw.com/api/cron/sync-tax-exemptions
  ```
  with the cron authorization header.
- **Revoking an exemption** works the same way — remove the state codes from `Tax Exempt Regions` (or clear `Tax Exemption Type`) in HubSpot and wait for the next sync.

---

### Complete System Flow

Here is the full end-to-end flow of how tax exemptions work across all three systems:

```
HUBSPOT (Sales Rep manages)
  Contact Properties:
    ├── tax_exemption_type: wholesale / government / other / non_exempt
    └── tax_exempt_regions: "CA,NY,TX" (comma-separated state codes)
        │
        ▼  Daily cron (2 AM UTC)
        
SCW COMMERCE DATABASE (local storage)
  customers table:
    ├── exemption_type: varchar(30)
    ├── exempt_regions: text (comma-separated)
    └── taxjar_customer_id: varchar(50)
        │
        ▼  Same cron pushes changes to TaxJar
        
TAXJAR CUSTOMER API (tax engine)
  POST/PUT /v2/customers/{id}
    ├── exemption_type: "wholesale"
    ├── exempt_regions: [{country: "US", state: "CA"}, ...]
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
