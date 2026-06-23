# Credit Terms Management

## Overview

Credit Terms (Purchase Order / NET30) allow approved B2B customers to place orders without paying upfront. Approval, the credit limit, and an optional **validity window** are managed in the **SCW Commerce admin → Operations → Credit Terms** panel. Every change is audit-logged and mirrored one-way to the customer's HubSpot contact (`approved_for_credit_terms`, `credit_limit`) for reference.

> **Note:** This supersedes the older "set the property in HubSpot" workflow described further below. The HubSpot contact properties are now a **mirror** of the admin panel, not the source of truth. (Those lower sections predate the admin panel and are kept for historical context.)

---

## Validity Window (Active From / Active Until)

Each customer's credit-terms approval can carry an optional date window, set in the admin **Credit Terms** panel:

| Field | Meaning |
|---|---|
| **Active from** | First day the customer may use Purchase-Order terms. Leave empty = active immediately. |
| **Active until** | Last day (inclusive) the customer may use Purchase-Order terms. Leave empty = never expires. |

A customer can use the **Purchase Order (NET30)** option at checkout only when they are **Approved** *and* today falls within this window (evaluated in US/Eastern time). Outside the window — before the start date or after the end date — the Purchase Order option is hidden at checkout **and** rejected by the server if a request is submitted directly. Leaving both dates empty means the approval never expires (this is the default, and matches how every existing approval behaves).

The Credit Terms table shows an **Active now / Inactive** badge per customer, so you can tell at a glance whether an approved customer's window is currently in effect (for example, an approval that is set up but whose start date hasn't arrived yet shows **Inactive**).

> **Note:** The validity window is enforced entirely in SCW Commerce. The start/end dates are not (yet) mirrored to HubSpot.

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

> [SCREENSHOT: The HubSpot Contact property panel showing Approved for Credit Terms (Yes) and Credit Limit. — images/hubspot-contact-credit-terms.png]

If you don't see these properties in the default view:
1. Click **"View all properties"** on the Contact
2. Search for "approved" or "credit"
3. Set the values
4. Optionally, click **"Actions" → "Customize properties"** to pin them to the default view

### Step 3: Save and Verify

The storefront updates from the HubSpot contact webhook within a few seconds when the webhook subscription is active. A daily **2 AM UTC** cron also reconciles the same fields in case a webhook was missed. After the update:
- The customer's storefront account is updated with the approval flag
- Next time they go to checkout, the **Purchase Order (NET30)** option appears

> **Note:** The checkout page fetches the customer's approval status fresh from `/api/customers/{id}` on every page load. A customer who was approved *after* their last login will see the Purchase Order option on their next checkout page load — they do **not** need to log out and back in.

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
3. Wait for the webhook update, or trigger the reconciliation sync manually if needed
4. The Purchase Order option will no longer appear at their checkout

> **Note:** Revoking credit terms does not affect existing orders. Any PO orders already placed will remain in their current status.

---

## What the Customer Sees

### Approved Customer (4 payment methods)

> [SCREENSHOT: Checkout showing Credit Card, Purchase Order (NET30), Check / Money Order, ACH / Wire Transfer]

The approved customer sees four payment methods: **Credit Card**, **Purchase Order (NET30)**, **Check / Money Order**, and **ACH / Wire Transfer**. The Purchase Order option shows the subtitle "Subject to credit approval."

### Non-Approved Customer (3 payment methods)

> [SCREENSHOT: The checkout payment method section showing only three options: Credit Card, Check / Money Order, ACH / Wire Transfer — no Purchase Order. — images/checkout-payment-methods-not-approved.png]

The Purchase Order option is completely hidden — the customer has no way to select it. The remaining three methods (**Credit Card**, **Check / Money Order**, **ACH / Wire Transfer**) are always available.

---

## How the Sync Works (Technical)

1. The HubSpot contact webhook updates the local customer row when subscribed contact properties change.
2. A daily cron job runs at **2 AM UTC** as reconciliation for every customer with a `hubspot_contact_id`.
3. For each customer, the cron fetches two properties from the HubSpot Contact:
   - `approved_for_credit_terms`
   - `credit_limit`
4. If the values differ from what's stored locally, it updates the customer record
5. The sync is one-way: **HubSpot → Storefront**. Changes made directly in the database will be overwritten by the next sync.

### Sync Summary

| Direction | What Syncs | Frequency |
|---|---|---|
| HubSpot → Storefront | `approved_for_credit_terms`, `credit_limit` | Real-time webhook + daily 2 AM UTC reconciliation |
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

Tax exemptions allow qualifying B2B customers to check out without paying sales tax in states where they hold a valid exemption. Common exempt customer types include wholesale/reseller businesses, government entities, and non-profit organizations.

Tax exemptions are **not** managed through HubSpot. They are managed through the **admin review queue inside SCW Commerce**. A customer (or an admin) submits an exemption request with supporting documents, an admin reviews and approves it in the admin panel, and approval immediately writes the customer record and pushes the exemption to TaxJar, which then applies $0 tax automatically during checkout.

---

### How a Tax Exemption Gets Set Up

There are three ways a customer becomes exempt:

**1. Customer-submitted request (self-service)**

1. A logged-in customer submits their exemption documents from the account portal (`POST /api/account/tax-exemption`).
2. The request lands in the admin review queue.
3. An admin opens **Admin → Tax Exemption Requests** (`/admin/tax-exemption-requests`), reviews the certificate, and approves or rejects it.
4. On approval (`POST /api/admin/tax-exemption-requests/[id]/approve`), the system calls `applyExemption()`, which writes the customer's exemption type and exempt regions to the database and pushes the record to TaxJar.

**2. Admin-created exemption**

An admin can create or edit an exemption directly from **Admin → Tax Exemptions** (`/admin/tax-exemptions`) without waiting for a customer request — for example when migrating a known wholesale account. This runs through the same `applyExemption()` path.

**3. Exempt organization (email-domain rule)**

SCW maintains a list of **tax-exempt organizations** keyed by email domain (**Admin → Tax-Exempt Orgs**, `/admin/tax-exempt-orgs`). Any customer whose email matches an exempt domain automatically inherits that organization's exemption type and exempt regions. This is useful for large accounts (e.g. a school district or government agency) where every employee buying with a `@org.gov` address should be exempt.

For every path, the exemption value is one of:

- `non_exempt` — Default, pays sales tax (no certificate required)
- `wholesale` — Resellers buying for resale (needs a resale certificate on file)
- `government` — Gov agencies, public schools, public universities (needs an exemption cert / PO)
- `other` — 501(c)(3) nonprofits, churches, diplomats, qualifying manufacturers (needs the specific exemption cert)

The **exempt regions** are a comma-separated list of state codes (e.g. `CA,NY,TX`):

- **Leave exempt regions EMPTY** to exempt the customer in **every nexus state** (blanket exemption).
- **List specific states** for partial exemption (e.g., a wholesaler with a KY cert but not NC → set `KY` → they'll still pay NC tax).

> **Warning:** Never approve an exempt type without a valid exemption certificate on file. If the customer is audited, SCW pays the unpaid tax.

![The SCW admin Tax Exemption Requests review queue showing a pending request with the customer's certificate, exemption type, and exempt regions](images/admin-tax-exemption-requests.png)

*The SCW admin Tax Exemption Requests review queue showing a pending request with the customer's certificate, exemption type, and exempt regions*

---

### Exemption Provenance & Audit Trail

Every customer's exemption carries a **source** so an admin can see how it was set:

| `exemption_source` | Meaning |
|---|---|
| `admin` | Set by an admin via the review queue or the Tax Exemptions admin page |
| `org` | Inherited automatically from a matching tax-exempt organization (email domain) |
| `hubspot_legacy` | Migrated from the previous Magento/HubSpot data — the default for pre-existing rows |

Alongside the source, the customer record stores who validated it and when (`exemption_validated_by`, `exemption_validated_at`), a reference to the document on file (`exemption_document_reference`), and the last update time (`exemption_updated_at`). Every change is also written to an **append-only `tax_exemption_events` audit table**, so the full history of who changed an exemption and when is preserved.

---

### How the Sync Works

The exemption write path is **SCW Admin → SCW Database → TaxJar** — HubSpot is not involved.

1. An admin approves a request (or an org rule matches), calling `applyExemption()`.
2. `applyExemption()` is **idempotent** — if the exemption type and regions are unchanged it does nothing (no DB write, no audit row, no TaxJar call).
3. When the exemption changed, it pushes the customer record to the **TaxJar Customer API** (`POST/PUT /v2/customers/{id}`) — this is what makes TaxJar apply $0 tax during calculation — and stores the returned TaxJar customer id on `customers.taxjar_customer_id`. The TaxJar push runs whenever the new type is not `non_exempt`, or whenever a TaxJar record already exists for the customer (so revocations are pushed too).
4. It writes `customers.exemption_type` / `customers.exempt_regions` (plus provenance fields) and appends a row to `tax_exemption_events`.

Changes take effect **immediately** on approval — there is no daily reconciliation cron for tax exemptions (the 2 AM UTC cron reconciles credit terms only).

### Applying Changes Immediately

Tax exemption changes apply the moment an admin approves the request in the admin panel — there is no separate sync step or cron endpoint to trigger. To re-push a customer to TaxJar (for example after a TaxJar environment switch), an admin re-runs the approval / save flow for that customer.

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

- **Exemptions are state-specific by default.** If you list specific states in the customer's exempt regions, the customer is exempt **only** in those states. To exempt a customer in **every** SCW nexus state, leave the exempt regions **empty**.
- **Changes apply immediately on approval.** Approving an exemption request writes the database and pushes to TaxJar in the same operation — there is no waiting period and no daily reconciliation cron for tax exemptions.
- **Exemptions are managed in SCW Commerce, not HubSpot.** There are no `tax_exemption_type` or `tax_exempt_regions` properties in HubSpot, and no webhook or cron that reads exemptions from HubSpot. All exemption changes go through the admin review queue (or an exempt-org email-domain rule).
- **Revoking an exemption** is done in the SCW admin panel — an admin sets the customer's exemption type back to `non_exempt` through the **Tax Exemption Requests** or **Tax Exemptions** admin UI. Because a TaxJar record already exists, the revocation is pushed to TaxJar too.

---

### Troubleshooting — Tax Still Charged When Customer Is Marked Exempt

If a quote or order is still charging tax for a customer you set as exempt, work through these in order:

1. **Is the exempt region the same as the ship-to state?**
   - A customer exempt only in TN (exempt regions = `TN`) will still pay IL tax on an IL order. This is correct behavior.
   - Fix: clear the restrictive state(s) for a blanket exemption, or add the ship-to state to the customer's exempt regions.

2. **Has the exemption actually been approved?**
   - Check `customers.exemption_type` in the SCW Commerce database by email:
     ```sql
     SELECT id, email, exemption_type, exempt_regions, taxjar_customer_id, exemption_source
     FROM customers WHERE email = '<customer-email>';
     ```
   - If `exemption_type` is still `non_exempt` → the request was never approved. Approve it in **Admin → Tax Exemption Requests**.
   - If `taxjar_customer_id` is empty → the TaxJar customer record was never created. The record is created during admin approval (`applyExemption → syncCustomerExemption`), and only when the exemption is non-`non_exempt`. Re-run the approval / save flow for the customer to force creation.

3. **Are you on staging with sandbox TaxJar?**
   - Sandbox and production TaxJar have **separate customer records**. A customer synced to prod TaxJar does **not** exist in sandbox TaxJar. Re-running the admin approval flow creates/updates whichever environment staging is currently pointed at.

4. **Is the customer covered by an exempt-org rule?**
   - If the customer's exemption should come from a tax-exempt organization, confirm their email domain matches an entry in **Admin → Tax-Exempt Orgs** and that the org's exempt regions include the ship-to state.

---

### Complete System Flow

Here is the full end-to-end flow of how tax exemptions work across all three systems:

<section class="modern-flow" aria-label="Tax exemption sync and calculation flow">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Tax exemption system flow</span>
      <span class="modern-flow__title">An admin approves the exemption, SCW stores it, TaxJar applies it at checkout</span>
    </div>
    <span class="modern-flow__badge">Applied immediately on approval</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">Exemption Request<small>customer-submitted, admin-created, or matched to an exempt org</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--start">SCW Admin Review<small>admin approves via /admin/tax-exemption-requests → applyExemption()</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">SCW Database<small>customers.exemption_type, exempt_regions, exemption_source, taxjar_customer_id + tax_exemption_events audit row</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">TaxJar Customer API<small>POST/PUT /v2/customers/{id}</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--done">Tax Calculation<small>POST /v2/taxes returns amount_to_collect: 0.00 when exempt</small></span>
  </div>
  <div class="modern-flow__note">Empty exempt regions means exempt in all nexus states; populated regions are synced as state-specific TaxJar exemptions. HubSpot is not in the tax-exemption data path.</div>
</section>

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

The system was seeded with exempt customers migrated from the previous Magento 2 platform. These migrated rows carry `exemption_source = 'hubspot_legacy'`, and each has its exempt regions (specific US states) already configured. New exemptions are managed through the SCW admin review queue going forward (`exemption_source = 'admin'`) or via tax-exempt organization email-domain rules (`exemption_source = 'org'`).

> To get current counts by exemption type, query the production database:
>
> ```sql
> SELECT exemption_type, COUNT(*)
> FROM customers
> WHERE exemption_type <> 'non_exempt'
> GROUP BY exemption_type;
> ```

---

### Troubleshooting

**Customer says they should be tax-exempt but are seeing tax:**
1. Check `customers.exemption_type` in the SCW Commerce database — is it set to something other than `non_exempt`?
2. Check `customers.exempt_regions` — does it include the shipping state (or is it empty for a blanket exemption)?
3. Confirm the admin has **approved** the customer's exemption request in **Admin → Tax Exemption Requests**. There are no HubSpot webhook subscriptions for tax exemptions and no daily tax-exemption cron — approval is what applies the exemption.
4. If the exemption should come from an exempt org, confirm the customer's email domain matches an entry in **Admin → Tax-Exempt Orgs**.

**Tax is $0 for a customer who shouldn't be exempt:**
1. Check `customers.exemption_type` in the SCW Commerce database — make sure it is `non_exempt`. If it is exempt, revoke it in the **Tax Exemptions** admin UI.
2. Verify the shipping state is in SCW's nexus list (non-nexus states always show $0).

**How to check a customer's exemption status in the database:**
An admin can verify by checking the customer's record in the SCW Commerce database for `exemption_type` and `exempt_regions` fields.
