# Credit Terms Management

## Overview

Credit Terms (NET30, labeled "Purchase Order" at checkout before July 2026) allow approved B2B customers to place orders without paying upfront. Approval, the credit limit, and the **revalidation window** are managed in the **SCW Commerce admin → Entitlements → Credit Terms** panel. Every change is audit-logged and mirrored one-way to the customer's HubSpot contact (`approved_for_credit_terms`, `credit_limit`) for reference.

> **Note:** This supersedes the older "set the property in HubSpot" workflow described further below. The HubSpot contact properties are now a **mirror** of the admin panel, not the source of truth. (Those lower sections predate the admin panel and are kept for historical context.)

***

## Where Credit Terms Live: the Company

Credit terms belong to a **company**, and a person reaches them by being a **member** of that company. There are two ways to become a member: the person's own email domain is registered to the company, or an administrator approves a guest link filed from the HubSpot contact card. Both grant the same thing. A plain HubSpot association grants nothing.

The company holds **one shared credit pool**. Every open purchase order from any member counts against the company's limit until the order is paid. A blank limit means uncapped. The revalidation window (18 months by default) is checked at order time along with the pool balance.

Company membership and the shared pool are managed at **Admin → Entitlements → Organizations**. New approvals are worked from **Admin → Requests → Credit Terms Requests**. See [Entitlement Request Workflows](entitlement-request-workflows.md) for the request and approval flow.

### One pool per business

Anyone who belongs to a company buys on the **company's** credit, never on a personal approval of their own. Personal credit terms are only for buyers who belong to no company, which in practice means people on a personal email address (Gmail, Yahoo and the like) that no company can own.

What that means day to day:

* **Admin → Entitlements → Credit Terms** shows a company member as "Orders on `<company>`'s credit" with the company's limit and an **Open company** link. There is nothing to approve on that row; change the limit or approval on the company page.
* If the company has no credit yet, the row says so. Approve credit on the company page and every member can order on it.
* **Add credit terms** will not approve a company member personally. It shows which company they belong to instead.
* When reviewing a request under **Credit Terms Requests**, an applicant who belongs to a company must be approved onto a company. The "this person only" choice is not offered for them.
* At checkout, a member who picks **Myself** under "Who is this order for?" is told to choose their company to pay by purchase order.
* When a rep converts a quote for a company member, the order is billed to the company. If the company has no credit yet, the rep is told to approve the company.

A few personal approvals that predate this rule belong to people whose company has no credit of its own. Those keep working, and can still be edited or removed on the Credit Terms screen, until the company is approved.

The HubSpot Storefront Account card labels which is which: **(personal)** for a grant on the contact's own account, **via `<company>`** for one that comes through a membership.

***

## Revalidation Window (Revalidate After)

Each approved customer carries a **Revalidate after** value (default 18 months), set in the admin **Credit Terms** panel. Their credit terms stay active for that many months counted from the **later** of:

* their most recent order, or
* the last time their credit-terms agreement was revalidated (they re-signed the agreement, or an admin pressed **Revalidate**).

A customer can use the **Credit Terms (NET30)** option at checkout (labeled "Purchase Order (NET30)" before July 2026) only when they are **Approved** _and_ that window has not expired. Once it expires, the Credit Terms option is hidden at checkout, rejected by the server if a request is submitted directly, and quote conversion to a credit-terms order is blocked. A customer with no orders and no revalidation date on record never expires while approved.

The Credit Terms table shows an **Active now / Inactive** badge per customer, plus the computed invalidation date and which event anchors it ("Last order ..." or "Re-signed ...").

**Reactivating an expired customer:** when a customer re-signs the Credit Terms Agreement, open **Admin → Entitlements → Credit Terms**, find the customer, and press **Revalidate** (the button appears on approved but inactive rows). This stamps a fresh revalidation date and reactivates them immediately, no new order required. Newly approving a customer (flipping them from not approved to Approved) stamps the revalidation date automatically.

> **Note:** The revalidation window is enforced entirely in SCW Commerce. The revalidation date is not mirrored to HubSpot (only the approval flag and credit limit are).

***

## API: Setting Credit Terms by Email (Automation / Make.com)

For automated flows (for example Make.com scenarios), two admin API endpoints set credit terms without needing the internal customer ID. Both authenticate with either an admin session or the `X-Admin-Api-Key` header, and both write through the same path as the admin panel: the change is audit logged and mirrored to the customer's HubSpot contact.

### Set one customer: `POST /api/admin/credit-terms/by-email`

Request body:

```json
{
  "email": "customer@example.com",
  "approved": true,
  "creditLimit": "50000",
  "revalidationMonths": 18,
  "note": "Approved via Make scenario"
}
```

* `email` and `approved` are required. `creditLimit`, `revalidationMonths`, and `note` are optional: when omitted, the customer's current values are preserved. Sending `creditLimit: null` (or an empty string) clears the limit.
* Response `200`: `{ "ok": true, "customerId": 123 }`
* Response `404`: `{ "error": "customer_not_found" }` (the email does not match a store customer)
* Response `409`: `{ "error": "company_member", "message": "...", "organizationId": 123 }` when the email belongs to a company member who is not already approved. Their credit is set on the company instead (see "One pool per business" above).
* Response `400`: `{ "error": "validation_error", ... }` for a malformed body

### Mass set (bulk): `POST /api/admin/credit-terms/bulk`

Sets eligibility for up to **500 customers** in one call.

```json
{
  "items": [
    { "email": "a@example.com", "approved": true, "creditLimit": "25000" },
    { "email": "b@example.com", "approved": false }
  ],
  "note": "Quarterly eligibility refresh"
}
```

* Each item takes the same fields as the by-email endpoint (minus `note`, which applies to the whole batch).
* Items are processed independently: a customer that is not found (or fails) never blocks the rest of the batch.
* Duplicate emails in one request are rejected with `400` and a `duplicates` list.
* Response `200`: `{ "ok": true, "updated": 42, "notFound": ["x@example.com"], "results": [{ "email": "...", "status": "updated" | "not_found" | "company_member" | "error" }] }`
* `company_member` means the email belongs to a company member who is not already approved; nothing was changed for them.

> **Note:** Customers must already exist in SCW Commerce. A contact that exists only in HubSpot and was never a store customer has no account to attach credit terms to, so the endpoint returns `customer_not_found` for them. (Admins can create the account first with the **Create ecommerce account** button on the HubSpot contact card — see [Customer Accounts](customer-accounts.md).)

***

## Credit Terms Record — Agreement Copy, Notes, Xero Link

Each row in **Admin → Entitlements → Credit Terms** has a **Record** button that opens the customer's credit-terms record. It holds three things (all optional):

| Field | What it's for |
| --- | --- |
| **Signed agreement (PDF)** | Upload the customer's signed Credit Terms Agreement so the paperwork lives with the approval. The Record button shows a green dot when an agreement is on file, and the stored file opens via a short-lived secure link. Uploading a new file replaces the current one. |
| **Notes** | Free-text internal notes about the account (context for approvals, collection history, special arrangements). Never shown to the customer. |
| **Xero Contact ID** | The customer's Xero contact identifier, so finance can jump from the SCW record to the matching Xero contact. This is a reference field only — it does not connect to Xero. |

Saving the Record dialog changes **only** these reference fields. It never touches the customer's approval, credit limit, or revalidation window, and it does not generate audit events or sync anything to HubSpot.

***

## Approving a Customer for Credit Terms (Legacy HubSpot workflow)

> **⚠️ Deprecated, historical reference only.** Credit terms are now approved in the **SCW Commerce admin → Entitlements → Credit Terms** panel (see **Overview** and **Validity Window** above). The HubSpot-entry steps below predate the admin panel and are kept only for historical context. **Do not follow them:** the "2 AM UTC reconciliation cron" and the `GET /api/cron/sync-credit-terms` endpoint mentioned in Step 3 **no longer exist**, and setting the HubSpot property by hand does **not** change a customer's approval. Credit terms now flow one-way **SCW → HubSpot**; the inbound HubSpot webhook ignores credit-terms changes.

### Step 1: Open the Contact in HubSpot

Navigate to the customer's Contact record in HubSpot.

![A HubSpot Contact record showing the About this Contact section in the left panel and Ecommerce Orders in the right sidebar.](.gitbook/assets/hubspot-contact-record.png)

_Navigate to a Contact record to find and update credit-terms properties._

### Step 2: Set the Properties

In the **"About this Contact"** section, find and set:

| Property                      | Value         | Description                                                                                                             |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Approved for Credit Terms** | Yes           | Enables the Purchase Order payment option at checkout                                                                   |
| **Credit Limit**              | e.g., `50000` | Maximum credit amount in USD. SCW Commerce enforces this for Purchase Order creation; HubSpot mirrors it for reference. |

![The HubSpot Contact left panel scrolled to show the custom SCW properties section where Approved for Credit Terms and Credit Limit appear when the contact has been synced with credit-terms data.](.gitbook/assets/hubspot-contact-credit-terms.png)

_The "About this Contact" panel — scroll down to find Approved for Credit Terms and Credit Limit in the custom SCW properties section._

If you don't see these properties in the default view:

1. Click **"View all properties"** on the Contact
2. Search for "approved" or "credit"
3. Set the values
4. Optionally, click **"Actions" → "Customize properties"** to pin them to the default view

### Step 3: Save and Verify

The storefront updates from the HubSpot contact webhook within a few seconds when the webhook subscription is active. A daily **2 AM UTC** cron also reconciles the same fields in case a webhook was missed. After the update:

* The customer's storefront account is updated with the approval flag
* Next time they go to checkout, the **Purchase Order (NET30)** option appears

> **Note:** The checkout page fetches the customer's approval status fresh from `/api/customers/{id}` on every page load. A customer who was approved _after_ their last login will see the Purchase Order option on their next checkout page load — they do **not** need to log out and back in.

To trigger an immediate sync (for testing or urgent approvals), an admin can call:

```
GET https://hubspot.getscw.com/api/cron/sync-credit-terms
```

with the cron authorization header.

***

## Revoking Credit Terms (Legacy HubSpot workflow)

> **⚠️ Deprecated, historical reference only.** Revoke credit terms in the **SCW Commerce admin → Entitlements → Credit Terms** panel by toggling the customer's approval off. The HubSpot steps below are retired; editing the HubSpot property does **not** sync back to SCW.

To remove a customer's ability to use Purchase Orders:

1. Open their Contact in HubSpot
2. Set **"Approved for Credit Terms"** to **No**
3. Wait for the webhook update, or trigger the reconciliation sync manually if needed
4. The Purchase Order option will no longer appear at their checkout

> **Note:** Revoking credit terms does not affect existing orders. Any PO orders already placed will remain in their current status.

***

## What the Customer Sees

### Approved Customer (4 payment methods)

> \[SCREENSHOT: Checkout showing Credit Card, Credit Terms (NET30), Check / Money Order, ACH / Wire Transfer]

The approved customer sees four payment methods: **Credit Card**, **Credit Terms (NET30)** (labeled "Purchase Order (NET30)" before July 2026), **Check / Money Order**, and **ACH / Wire Transfer**. The Credit Terms option shows the subtitle "Subject to credit approval."

### Non-Approved Customer (3 payment methods)

> \[SCREENSHOT: The checkout payment method section showing only three options: Credit Card, Check / Money Order, ACH / Wire Transfer — no Credit Terms. — images/checkout-payment-methods-not-approved.png]

The Credit Terms option is completely hidden — the customer has no way to select it. The remaining three methods (**Credit Card**, **Check / Money Order**, **ACH / Wire Transfer**) are always available.

***

## How the Sync Works (Technical)

Credit terms are **admin-owned in SCW Commerce** (the admin panel is the source of truth). When an admin saves a credit-terms change, the system:

1. Writes the new values (`approved_for_credit_terms`, `credit_limit`, revalidation months, and when applicable a fresh revalidation date) to the local customer row inside a transaction.
2. Appends an audit event to `credit_terms_events`.
3. Enqueues a `customer.credit_terms_changed` row in the HubSpot outbox (part of the same transaction — failure rolls back the edit).
4. Kicks off async delivery of that outbox row: `approved_for_credit_terms` + `credit_limit` are pushed to the matching HubSpot Contact via `PATCH /crm/v3/objects/contacts/{id}`.

The sync is one-way: **Storefront → HubSpot**. The HubSpot contact values are a mirror for reference only. Changes made directly in HubSpot are **not** synced back to SCW (the webhook handler does not subscribe to or process `approved_for_credit_terms` changes from HubSpot).

### Sync Summary

| Direction            | What Syncs                                  | Frequency                                        |
| -------------------- | ------------------------------------------- | ------------------------------------------------ |
| Storefront → HubSpot | `approved_for_credit_terms`, `credit_limit` | Real-time via HubSpot outbox on every admin save |
| HubSpot → Storefront | Nothing (one-way sync)                      | —                                                |

***

## Credit Limit Enforcement

The credit limit is enforced by SCW Commerce for every new Purchase Order order, including checkout and admin/automation-created orders.

When a Purchase Order order is created, the order service:

* Re-checks that the customer has active credit terms
* Locks the customer row so concurrent PO orders cannot race past the same limit
* Sums open PO exposure for that customer
* Rejects the order when `open exposure + this order total` exceeds the customer's credit limit

Open exposure is calculated per Purchase Order order (excluding cancelled orders) as the order total minus what has been settled through paid or refunded invoices, never below zero. A partial invoice only clears the portion it covers — a paid deposit invoice does not release the rest of the order's credit. Shipped-but-unpaid NET30 orders still consume credit until their invoices are paid.

If the limit is exceeded, the order is not created and checkout shows: _"Purchase Order total exceeds the approved credit limit. Please contact your account manager."_ Support should review the customer's open PO balance, paid/refunded invoice state, and configured credit limit before retrying, increasing the limit, or directing the customer to Credit Card, Check, or ACH/Wire.

Leaving **Credit Limit** blank means the customer is approved for uncapped credit terms while their approval is active.

When the buyer is billing a **company** rather than a personal approval, the same rules run against the company's shared pool: open purchase orders from every member of that company count together against the company limit, and the company's revalidation window applies. The pool balance is visible on the company page at **Admin → Entitlements → Organizations**.

When existing per-customer approvals were converted into a company, the company took the **highest** credit limit among them, and any uncapped account overrode the ceiling entirely.

***

## Tax Exemptions

### Overview

Tax exemptions allow qualifying B2B customers to check out without paying sales tax in states where they hold a valid exemption. Common exempt customer types include wholesale/reseller businesses, government entities, and non-profit organizations.

Tax exemptions are **not** managed through HubSpot. They are managed through the **admin review queue inside SCW Commerce** and on the company page. A customer (or an admin) submits an exemption request with supporting documents, an admin reviews and approves it in the admin panel, and the exemption applies from the next order.

Exemptions belong to **companies**. An order is exempt when the company it is for holds an exemption covering the ship-to state. The company is the one the buyer picks at checkout ("Who is this order for?"), else the company the HubSpot quote was written for, else the buyer's only company, else the company that owns their email domain. Personal exemptions apply only to buyers on a free email address (gmail, yahoo, and similar), such as a church volunteer. See [Which Exemption an Order Gets](tax-exemption-webhook.md#which-exemption-an-order-gets) for the full rule.

***

### How a Tax Exemption Gets Set Up

There are three ways an exemption is set up:

**1. Customer-submitted request (self-service)**

1. A logged-in customer submits their exemption documents from the account portal (`POST /api/account/tax-exemption`).
2. The request lands in the admin review queue.
3. An admin opens **Admin → Tax Exemption Requests** (`/admin/tax-exemption-requests`), reviews the certificate, and approves or rejects it.
4. On approval (`POST /api/admin/tax-exemption-requests/[id]/approve`), the exemption lands on a company or a person:
   * **Company email**: always on a company. That is the company that owns the email domain unless the admin picks another one. If no company owns the domain yet, approval creates one for it. "This person only" is not offered.
   * **Free email**: on the person's own account ("This person only"), which is also pushed to TaxJar. If the admin picks a company, the exemption goes on that company, the applicant becomes a member, and the applicant also gets the exemption as their own.

**2. Admin-set company exemption**

An admin can set or change a company's exemption type, exempt states, and certificate expiry directly on the company page at **Admin → Entitlements → Organizations**, without waiting for a request. **Admin → Tax Exemptions** is read-only.

**3. Company membership and email domain**

A company's exemption reaches everyone who buys for it: its members (email domain match, approved guest link, or added by an admin), every account on its email domains, and every HubSpot quote written for it. This is what covers large accounts (a school district or a government agency) where everyone buying with an `@org.gov` address should be exempt, and it is also what covers the buyer on a personal address whom an admin has linked to the company. Nothing is copied onto people's accounts: tax reads the company on every order.

Companies and their members are managed at **Admin → Entitlements → Organizations**.

For every path, the exemption value is one of:

* `non_exempt` — Default, pays sales tax (no certificate required)
* `wholesale` — Resellers buying for resale (needs a resale certificate on file)
* `government` — Gov agencies, public schools, public universities (needs an exemption cert / PO)
* `other` — 501(c)(3) nonprofits, churches, diplomats, qualifying manufacturers (needs the specific exemption cert)

The **exempt regions** are a comma-separated list of state codes (e.g. `CA,NY,TX`):

* **At least one state is required.** Empty exempt regions mean **not exempt anywhere**. There is no blanket "every state" exemption; select every state the certificate covers.
* **List specific states** for partial exemption (e.g., a wholesaler with a KY cert but not NC → set `KY` → they'll still pay NC tax).

> **Warning:** Never approve an exempt type without a valid exemption certificate on file. If the customer is audited, SCW pays the unpaid tax.

![The SCW admin Tax Exemption Requests review queue showing a pending request with the customer's certificate, exemption type, and exempt regions](.gitbook/assets/admin-tax-exemption-requests.png)

_The SCW admin Tax Exemption Requests review queue showing a pending request with the customer's certificate, exemption type, and exempt regions_

***

### Exemption Provenance & Audit Trail

A company's exemption (type, states, certificate expiry) is stored on the company, and every change to it is recorded in the company's edit history in **Admin → Entitlements → Organizations**.

An exemption on a customer's own account carries a **source** so an admin can see how it was set:

| `exemption_source` | Meaning |
| ------------------ | ------- |
| `admin`            | A personal exemption approved by an admin in the review queue |
| `org`              | A legacy copy of a company exemption, written onto member accounts before exemptions moved to companies. Tax ignores it and reads the company. No new `org` rows are written. |
| `hubspot_legacy`   | Migrated from the previous Magento/HubSpot data (the default for pre-existing rows). Treated as a personal exemption. |

A personal exemption (`admin` or `hubspot_legacy`) applies only while the account's email is a free email. On a company email it is not applied, and **Admin → Tax Exemptions** marks it **Not applied: company email**.

Alongside the source, the customer record stores who validated it and when (`exemption_validated_by`, `exemption_validated_at`), a reference to the document on file (`exemption_document_reference`), and the last update time (`exemption_updated_at`). Every change is also written to an **append-only `tax_exemption_events` audit table**, so the full history of who changed an exemption and when is preserved.

***

### How the Sync Works

HubSpot is not an input to tax exemption. There are two write paths:

* **Company exemption: SCW Admin → SCW Database.** Approval (or an edit on the company page) writes the exemption onto the company. Nothing goes to TaxJar: when the order's company covers the ship-to state, SCW sets tax to $0 itself.
* **Personal exemption (free email only): SCW Admin → SCW Database → TaxJar.**
  1. An admin approves a request as "This person only" (or approves a free-email applicant for a company), calling `applyExemption()`.
  2. `applyExemption()` is **idempotent**: if the exemption type and regions are unchanged it does nothing (no DB write, no audit row, no TaxJar call).
  3. When the exemption changed, it pushes the customer record to the **TaxJar Customer API** (`POST/PUT /v2/customers/{id}`), which is what lets TaxJar apply the exemption during calculation, and stores the returned TaxJar customer id on `customers.taxjar_customer_id`. The TaxJar push runs whenever the new type is not `non_exempt`, or whenever a TaxJar record already exists for the customer (so revocations are pushed too).
  4. It writes `customers.exemption_type` / `customers.exempt_regions` (plus provenance fields) and appends a row to `tax_exemption_events`.

SCW Commerce then updates the display-only HubSpot contact properties `tax_exemption_type` and `tax_exempt_regions` through the outbox, with the same answer checkout uses. See [HubSpot Contact Properties](tax-exemption-webhook.md#hubspot-contact-properties).

Changes take effect **immediately**: there is no daily reconciliation cron for tax exemptions (the 2 AM UTC cron reconciles credit terms only).

### Applying Changes Immediately

Tax exemption changes apply from the next order and the next quote price once an admin approves the request or saves the company. There is no separate sync step or cron endpoint to trigger. To re-push a personal exemption to TaxJar (for example after a TaxJar environment switch), an admin re-runs the approval for that customer.

### What the Customer Sees

* At checkout, if the company the order is for covers the shipping destination state (or, for a free-email buyer, their personal exemption does), sales tax shows as **$0**
* No special action is required from the customer: the exemption applies automatically
* If the order is not exempt in the shipping state, normal tax rates apply
* The account's **Tax Exemption** page and **My Companies** show the same answer checkout uses

***

### Exemption Types

| Type         | Description                                           |
| ------------ | ----------------------------------------------------- |
| `wholesale`  | Wholesale or reseller customers purchasing for resale |
| `government` | Federal, state, or local government entities          |
| `other`      | Non-profits or other qualifying exempt organizations  |

***

### Important Notes

* **Exemptions are per state.** An exemption covers **only** the states listed in its exempt regions. Empty exempt regions mean **not exempt anywhere**. List each state the certificate covers.
* **The company decides, not the person.** A buyer on a company email always uses their company's exemption, and a personal exemption on a company email is never applied. Personal exemptions are for free-email buyers only.
* **Changes apply immediately on approval.** There is no waiting period and no daily reconciliation cron for tax exemptions.
* **Exemptions are managed in SCW Commerce, not HubSpot.** The HubSpot contact properties `tax_exemption_type` and `tax_exempt_regions` are **display only**: SCW writes the same answer checkout uses, and editing them in HubSpot changes nothing. No webhook or cron reads exemptions from HubSpot.
* **Revoking a company exemption** is done with **Revoke** on the company page in **Admin → Entitlements → Organizations**. Orders for that company are taxed from then on. The admin has no revoke control for a personal exemption: **Tax Exemption Requests** can only amend the type and states, and **Tax Exemptions** is read-only. Ask engineering to clear one.

***

### Troubleshooting: Tax Still Charged When Customer Is Marked Exempt

If a quote or order is still charging tax for a customer you set as exempt, work through these in order:

1. **Which company is the order for?** The first match wins:
   * the company the buyer picked at checkout under "Who is this order for?" (a pick beats everything, even when another company, such as the one owning their email domain, would exempt them);
   * on a quote, the company SCW picked for the quote (see [Quote Builder](quote-builder.md)). That HubSpot company counts only when it is linked to a company in **Admin → Entitlements → Organizations**;
   * the buyer's only company. A member of two or more companies has none by default and must pick at checkout;
   * the company that owns the buyer's email domain.

   The buyer must be signed in (or on a quote payment link). An email typed at guest checkout never makes an order exempt.
2. **Does that company cover the ship-to state?**
   * Open the company at **Admin → Entitlements → Organizations** and confirm it holds an exemption and its exempt regions include the ship-to state.
   * A company exempt only in TN (exempt regions = `TN`) still pays IL tax on an IL order. This is correct behavior. Fix: add the ship-to state to the company's exempt regions when the certificate covers it.
   * If the buyer should belong to the company but is not a member and is not on its email domain, file **Link Guest Email to Company** from the contact card and approve it under **Requests → Membership Requests**. A HubSpot association on its own grants nothing.
3. **Is it a personal exemption?** Personal exemptions apply only to free-email buyers (gmail, yahoo, and similar).
   *   Check the account in the SCW Commerce database by email:

       ```sql
       SELECT id, email, exemption_type, exempt_regions, taxjar_customer_id, exemption_source
       FROM customers WHERE email = '<customer-email>';
       ```
   * If **Admin → Tax Exemptions** shows **Not applied: company email**, the buyer is on a company email and only their company's exemption counts. Approve the exemption for the company instead.
   * If `exemption_type` is still `non_exempt` → the request was never approved. Approve it in **Admin → Tax Exemption Requests**.
   * If `taxjar_customer_id` is empty → the TaxJar customer record was never created. The record is created during admin approval (`applyExemption → syncCustomerExemption`), and only when the exemption is non-`non_exempt`. Re-run the approval for the customer to force creation.
4. **Are you on staging with sandbox TaxJar?**
   * Sandbox and production TaxJar have **separate customer records**. A customer synced to prod TaxJar does **not** exist in sandbox TaxJar. Re-running the admin approval flow creates/updates whichever environment staging is currently pointed at. (This affects personal exemptions only; company exemptions never touch TaxJar.)

***

### Complete System Flow

Here is the full end-to-end flow of how tax exemptions work across all three systems:

1. **Exemption request**: customer-submitted, or created by an admin or a rep from the HubSpot card.
2. **SCW Admin review**: an admin approves it at `/admin/tax-exemption-requests`. Approval applies immediately.
3. **SCW Database**: a company exemption is written to the company (`organizations`: exemption type, exempt states, certificate expiry, plus an edit history entry). A free email's personal exemption is written to the account (`customers.exemption_type`, `exempt_regions`, `exemption_source`, `taxjar_customer_id`, plus a `tax_exemption_events` audit row). A free-email applicant approved for a company gets both.
4. **TaxJar Customer API** (personal exemptions only): `POST/PUT /v2/customers/{id}`.
5. **Tax calculation**: SCW decides which company the order is for. If that company covers the ship-to state, tax is $0 and TaxJar is not asked. Otherwise SCW calls `POST /v2/taxes`, with the buyer's TaxJar customer id only when their personal exemption covers the state.

Empty exempt regions mean exempt nowhere. HubSpot only displays the result: the contact properties `tax_exemption_type` and `tax_exempt_regions` are written by SCW and never read back.

***

### How Tax Calculation Works at Checkout

When a customer reaches checkout and enters a shipping address, the system:

1. **Decides the exemption.** SCW works out which company the order is for. If that company's exemption covers the ship-to state, tax is $0 and TaxJar is not asked.
2. **Checks nexus.** Does SCW have a sales tax obligation in that state? SCW has nexus in 29 states. If no nexus, tax is always $0 (no API call needed).
3. **Builds the request.** Sends to TaxJar:
   * **From address:** SCW warehouse in Asheville, NC
   * **To address:** Customer's shipping address
   * **Line items:** Each product with quantity, price, and product tax code
   * **Shipping amount:** After discounts
   * **Customer ID:** sent only when the buyer is on a free email and their personal exemption covers the ship-to state
4. **TaxJar processes.** For each line item, TaxJar:
   * Applies the personal exemption, when a customer ID was sent
   * Checks if the product tax code has state-specific rules
   * Calculates tax by jurisdiction (state, county, city, special district)
   * Returns $0 for exempt items/states
5. **Tax is displayed.** The checkout shows the total tax. Exempt orders show $0 in their exempt states.

***

### Product Tax Codes

Most SCW products are standard taxable goods. However, some product types are taxed differently by state:

| Product Type                         | Tax Code | Examples                                        | Tax Treatment                                            |
| ------------------------------------ | -------- | ----------------------------------------------- | -------------------------------------------------------- |
| **Hardware** (cameras, NVRs, cables) | Default  | All cameras, recorders, accessories             | Standard sales tax in all nexus states                   |
| **SaaS / Software Licensing**        | `30070`  | SCW AI Licenses, OpenPath Licenses, VSAAS Cloud | Some states exempt software; others tax at reduced rates |
| **Installation Services**            | `10040`  | (Not currently sold online)                     | Service tax rules vary by state                          |

Product tax codes are automatically mapped from the product's `tax_class_id` field. No manual configuration is needed — the system handles this at checkout.

***

### SCW Nexus States (29 states)

SCW is registered to collect sales tax in these states:

```
AK  AZ  CA  CO  FL  GA  HI  ID  IL  IN
KS  KY  LA  MA  MD  MI  MO  NC  ND  NJ
OH  OK  PA  SC  TN  TX  VA  WA  WI
```

Orders shipping to states **not** on this list are never taxed, regardless of exemption status.

***

### Current Exempt Customer Data

The system was seeded with exempt customers migrated from the previous Magento 2 platform. These migrated rows carry `exemption_source = 'hubspot_legacy'`, and each has its exempt regions (specific US states) already configured. New exemptions are managed through the SCW admin review queue going forward: company exemptions are stored on the company (`organizations`), and personal exemptions for free-email buyers on the account (`exemption_source = 'admin'`). Account rows with `exemption_source = 'org'` are legacy copies of company exemptions; tax ignores them and no new ones are written.

> To get current counts by exemption type, query the production database. Companies:
>
> ```sql
> SELECT exemption_type, COUNT(*)
> FROM organizations
> WHERE exemption_type <> 'non_exempt'
> GROUP BY exemption_type;
> ```
>
> Account rows (personal exemptions plus legacy `org` copies):
>
> ```sql
> SELECT exemption_type, COUNT(*)
> FROM customers
> WHERE exemption_type <> 'non_exempt'
> GROUP BY exemption_type;
> ```

***

### Troubleshooting

**Customer says they should be tax-exempt but are seeing tax:**

1. Work out which company the order is for (see [Troubleshooting: Tax Still Charged](#troubleshooting-tax-still-charged-when-customer-is-marked-exempt)). Did they pick a different company, or **Myself** on a free email, at checkout?
2. Open that company at **Admin → Entitlements → Organizations**: does it hold an exemption, and do its exempt states include the shipping state? Empty states mean exempt nowhere.
3. Confirm the admin has **approved** the customer's exemption request in **Admin → Tax Exemption Requests**. There are no HubSpot webhook subscriptions for tax exemptions and no daily tax-exemption cron: approval is what applies the exemption.
4. For a personal exemption, check the account is on a free email. A personal exemption on a company email is never applied (**Admin → Tax Exemptions** shows **Not applied: company email**).

**Tax is $0 for a customer who shouldn't be exempt:**

1. Find the company the order is for and check its exemption on the company page. Revoke it there with **Revoke** if it is wrong. For a free-email buyer, also check the personal exemption on their account.
2. Verify the shipping state is in SCW's nexus list (non-nexus states always show $0).

**How to check a customer's exemption status:** the customer's **Tax Exemption** account page, the HubSpot Storefront Account card, and the HubSpot contact properties `tax_exemption_type` / `tax_exempt_regions` all show the same answer checkout uses. In the database, a company's exemption is on `organizations` (`exemption_type`, `exempt_regions`) and a personal one on `customers` (same field names).
