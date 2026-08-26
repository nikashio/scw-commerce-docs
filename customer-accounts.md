# Customer Accounts

## Overview

SCW Commerce uses **AWS Cognito** for authentication and a local **PostgreSQL** database for customer profiles. Customers migrated from Magento go through a one-time password reset flow.

***

## Customer Login

### New Customers (created on SCW Commerce)

1. Customer clicks **Sign In** or navigates to `/login`
2. Enters email and password
3. Cognito authenticates → NextAuth creates a session (30-day max)
4. Customer is redirected to their account page

![The /login page: two-column layout — Registered Customers (email/password form + Forgot Your Password link) and New Customers (Create an Account button)](.gitbook/assets/customer-accounts-login-page.png)

### Migrated Customers (from Magento)

Customers migrated from Magento have a special first-login flow:

1. Customer enters their email and password on the login page
2. The system detects their Cognito status is `FORCE_CHANGE_PASSWORD` (migrated account) — at this point a password reset code is **automatically sent to their email**
3. Instead of an error, the customer sees an info message: _"Your account has been migrated to our new site. We've sent a password reset code to your email. Please check your inbox and use the link below to set a new password."_ with a **"Reset Your Password →"** link
4. Customer clicks the link → taken to `/reset-password?email=<their-email>&migrated=true` (the reset form is pre-filled with their email)
5. The code was already sent in step 2, so the customer does not need to request a new one — they enter the code from their inbox and choose a new password
6. After reset, they can log in normally going forward

> \[SCREENSHOT: The login page after a migrated-user login attempt, showing the info-box message 'Your account has been migrated to our new site...' and the Reset Your Password link in place of an error — images/customer-accounts-login-migrated-message.png]

> \[SCREENSHOT: Reset password page]

***

## Customer Registration

### Self-Registration (customer-initiated)

1. Customer clicks **Create Account** or navigates to `/register`
2. Fills in: First Name, Last Name, Email, Password
3. The account is created in **Cognito only** (the local database record is created later, on first sign-in)
4. Cognito emails a 6-digit verification code. The form moves to a **verify** step where the customer enters that code to confirm their email
5. After verification, the customer sees _"Email verified! You can now sign in."_ — they are **not** logged in automatically and must sign in on the `/login` page

![The /register page: Create New Customer Account form with Personal Information (First/Last Name) and Sign-in Information (Email, Password, Confirm Password) fieldsets](.gitbook/assets/customer-accounts-register-page.png)

### Auto-Provisioned by Sales Rep (via HubSpot webhook)

When a sales rep creates a new Contact in HubSpot, the customer account can be **automatically created** in SCW Commerce within seconds — **but only when auto-provisioning is turned on**.

> **Auto-provisioning is gated OFF by default.** It runs only when `HUBSPOT_WEBHOOK_AUTOPROVISION=true` is set in the environment. This guard exists so bulk/migration contact creation never silently provisions accounts. Without the flag, a brand-new HubSpot contact does **not** get an SCW account from the webhook (existing SCW customers are still linked). Set the flag at go-live to enable this flow for real sales-created contacts.

When the flag is enabled:

1. Rep creates a Contact in HubSpot (enters email, name, company, etc.)
2. HubSpot fires a webhook to SCW Commerce (`POST /api/webhooks/hubspot/contact`)
3. SCW Commerce:
   * Fetches the full contact details from HubSpot API
   * Creates a Cognito login account (with temporary password)
   * Creates a customer record in the local database, linked to the HubSpot Contact
   * Sends a welcome email: **"Your SCW Account Has Been Created"** with a "Set Your Password" button — **only if `HUBSPOT_WEBHOOK_WELCOME_EMAIL=true` is also set** (a separate flag, also off by default, so a migration backfill doesn't mass-email stale Magento addresses). When suppressed, the account is still created but no email goes out.
4. The customer can set their password whenever they want — no urgency
5. The sales rep can immediately use Payment Links or the Quote Builder for this customer

**What the customer receives (when the welcome email is enabled):**

* A welcome email explaining their account was created by their sales representative
* A link to set their password at `/reset-password?email=<their-email>&welcome=true`

**What the rep can do immediately:**

* Build a quote and generate a payment link for the customer
* Check out on behalf of the customer (the order is assigned to the customer's record)

### Invitation by Sales Rep (manual invite link)

Separate from the webhook auto-provision path, the sales team can manually invite a HubSpot contact to register:

1. Sales creates an invitation → the system generates a secure token (valid for 7 days), stored in the database
2. An email goes out with a registration link: `/register?token=xxx`
3. The customer clicks the link → the token is validated and the registration form is shown
4. The customer sets a password → the invitation is accepted, creating a Cognito user **and** a local customer record

This path always requires the customer to set their own password through the tokenized link; it does not depend on the `HUBSPOT_WEBHOOK_AUTOPROVISION` flag.

### Property Sync (real-time via webhook)

When a rep updates a Contact in HubSpot, the HubSpot private app (**"Frantic-Actor / claude code key"**, app id `35018267` on portal `51265320`) fires a signed webhook at **`POST https://hubspot.getscw.com/api/webhooks/hubspot/contact`**. SCW Commerce verifies the signature, groups the events by HubSpot object ID (so a contact's creation is processed before its property changes), and updates the matching `customers` row. (Note: there is no event-ID deduplication — events are ordered, not de-duplicated.)

| HubSpot Property            | SCW Commerce Field                     | Webhook Subscribed?                                                                                                           | Handler?                                                                |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `email`                     | `customers.email`                      | ✅                                                                                                                             | ✅                                                                       |
| `firstname`                 | `customers.firstName`                  | ✅                                                                                                                             | ✅                                                                       |
| `lastname`                  | `customers.lastName`                   | ✅                                                                                                                             | ✅                                                                       |
| `company`                   | `customers.company`                    | ❌ not subscribed — add in HubSpot if needed                                                                                   | ✅                                                                       |
| `phone`                     | `customers.phone`                      | ❌ not subscribed — add in HubSpot if needed                                                                                   | ✅                                                                       |
| `approved_for_credit_terms` | `customers.approvedForCreditTerms`     | ❌ not handled by incoming webhook — credit terms are admin-owned in SCW; changes are pushed **out** to HubSpot via the outbox | ❌ falls through to `webhook_unhandled_property` log                     |
| `credit_limit`              | `customers.creditLimit`                | ❌ not handled by incoming webhook — mirrored out to HubSpot on each admin save                                                | ❌ falls through to `webhook_unhandled_property` log                     |
| `tax_exemption_type`        | — (intended `customers.exemptionType`) | ❌ no such Contact property in HubSpot                                                                                         | ❌ **not handled** — falls through to a `webhook_unhandled_property` log |
| `tax_exempt_regions`        | — (intended `customers.exemptRegions`) | ❌ no such Contact property in HubSpot                                                                                         | ❌ **not handled** — falls through to a `webhook_unhandled_property` log |

The webhook handler only maps `email`, `firstname`, `lastname`, `company`, and `phone`. `approved_for_credit_terms` and `credit_limit` are **not** handled by the incoming webhook — credit terms are managed in the SCW admin panel and pushed **out** to HubSpot via the outbox on each save (see Credit Terms docs). `tax_exemption_type` and `tax_exempt_regions` do **not** exist as HubSpot Contact properties and have no handler case — any unmapped property change is logged as `webhook_unhandled_property` and ignored.

Properties not in the list above **are not synced inbound**. There is **no** daily reconciliation cron for credit terms or tax-exemption fields. Profile fields (`email`, `firstname`, `lastname`, `company`, `phone`) flow only through the inbound webhook. If a sales rep edits something outside this list, it stays in HubSpot.

### Viewing & Editing Webhook Subscriptions

1. HubSpot → gear icon (Settings) → **Integrations → Private Apps**
2. Open the **"Frantic-Actor / claude code key"** app
3. **Webhooks** tab → scroll to **Event subscriptions → Contact**
4. To add a new property subscription: **Create subscription** → Object type: _Contact_ → Event: _Property change_ → pick the property → Save, then **Activate** at the top.

Direct link (sandbox portal): `https://app.hubspot.com/private-apps/51265320/35018267/webhooks`

> **Error counts shown in the HubSpot webhooks tab** (e.g., 19/28 errors on `email` changes) indicate events where SCW Commerce returned a non-200. Common causes: signature clock drift, timeouts, or the matching customer row not existing yet. To triage, run `pm2 logs scw-app` on the server (or open Sentry) and look for `event=webhook_contact_error` lines. The app logs to stdout via the pino logger — there is no `/logs/api.log` file.

### Contact Deletion

When a Contact is deleted in HubSpot, the customer account is **NOT deleted** (they may have order history). The HubSpot link is removed (`hubspotContactId` set to null).

### When Does the Customer Get a HubSpot Contact?

There are two paths:

**Path A (sales-initiated):** The rep creates the Contact in HubSpot first → webhook auto-creates the SCW account. The HubSpot Contact exists from the start.

**Path B (self-registration):** The customer registers on the website → a HubSpot Contact is created when they place an order and that order syncs to HubSpot. Contact resolution runs on **every** order sync (not just the first) and is idempotent — it looks the contact up by `hubspotContactId`, then by email, and only creates a new one if neither matches, so repeat orders never create duplicates. On each sync the system:

1. Checks if a HubSpot Contact already exists for this email
2. If not, creates one
3. Associates the Ecommerce Order with the Contact

***

## Password Reset

1. Customer clicks **Forgot Password?** on the login page
2. Enters their email
3. Cognito sends a verification code to the email
4. Customer enters the code and new password on `/reset-password`
5. Password updated — customer can log in with the new password

![The Forgot Your Password page: a Password Reset card with an email field and a Send Reset Code button](.gitbook/assets/customer-accounts-forgot-password.png)

***

## My Account Dashboard

After logging in, the customer can access their account at `/account`:

![The /account page for a logged-in customer showing the sidebar navigation (My Account, My Orders, Address Book, Account Information, Change Password, Tax Exemption) and the main content area](.gitbook/assets/customer-accounts-account-dashboard.png)

_The /account page for a logged-in customer showing the sidebar navigation (My Account, My Orders, Address Book, Account Information, Change Password, Tax Exemption) and the main content area_

### Account Sections

| Section                 | Path                       | What It Shows                                                                                            |
| ----------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| **My Account**          | `/account`                 | Overview with contact info and default addresses                                                         |
| **My Orders**           | `/account/orders`          | All orders with status, date, total                                                                      |
| **Address Book**        | `/account/addresses`       | Saved shipping and billing addresses                                                                     |
| **Account Information** | `/account/profile`         | Edit name, phone, company (email is read-only — _"Email cannot be changed. Contact support if needed."_) |
| **Change Password**     | `/account/change-password` | Update password via Cognito                                                                              |
| **Tax Exemption**       | `/account/tax-exemption`   | View/manage tax-exemption status                                                                         |
| **My Companies**        | `/account/organizations`   | The companies the customer can buy for, and what each one grants                                         |

***

## Order History

The **My Orders** page shows all orders associated with the customer's account:

| Column          | Description                                                                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Order #**     | Order number (e.g., `SCW-20260406-A1B2`)                                                                                                                                                                                                 |
| **Date**        | When the order was placed                                                                                                                                                                                                                |
| **Ship To**     | Shipping address (if available)                                                                                                                                                                                                          |
| **Order Total** | Grand total                                                                                                                                                                                                                              |
| **Status**      | Current status. The display only capitalizes the **first character** of the raw status, so the values a customer sees are: Pending, `Pending_payment` (with the underscore), Authorized, Paid, Processing, Shipped, Delivered, Cancelled |
| **Action**      | "View Order" link to order detail page                                                                                                                                                                                                   |

![The /account/orders page showing the My Orders table with columns Order #, Date, Ship To, Order Total, Status, Action and several orders in differing statuses](.gitbook/assets/customer-accounts-order-history.png)

_The /account/orders page showing the My Orders table with columns Order #, Date, Ship To, Order Total, Status, Action and several orders in differing statuses_

### Order Detail Page

Click **View Order** to see:

* Full order summary (items, quantities, prices)
* Order totals (subtotal, shipping, tax, grand total)
* Shipping and billing addresses
* Order status
* Shipping method and tracking number for shipped orders
* Customer notes (if any)

For shipped orders, the detail page shows a **Shipment** section with the shipping method, tracking number, carrier, and shipped date from the latest shipment. If the carrier provides a tracking URL, the tracking number links directly to the carrier tracking page.

![An order detail page at /account/orders/{orderNumber} showing the items table, totals, shipping address card, and billing address card](.gitbook/assets/customer-accounts-order-detail.png)

_An order detail page at /account/orders/{orderNumber} showing the items table, totals, shipping address card, and billing address card_

### Which Orders Appear Here?

* Orders placed by the customer directly (credit card checkout)
* Orders placed by a sales rep on behalf of the customer (via payment link)
* Historical orders migrated from Magento (order numbers like `1068857454`)
* **Offline payment orders** (Check, Wire, PO) — these show with status "Pending\_payment" until the admin invoices them

***

## Address Book

Customers can save multiple shipping and billing addresses:

1. Navigate to **Address Book** → `/account/addresses`
2. Click **Add New Address**
3. Fill in the address form
4. Select **Default Shipping** and/or **Default Billing** if desired
5. Save

Saved addresses are available:

* At checkout (as selectable cards instead of manual entry)
* When a sales rep checks out on behalf of the customer (addresses load automatically)

![The /account/addresses page showing saved shipping and billing address cards with Set as Default and Delete actions](.gitbook/assets/customer-accounts-address-book.png)

_The /account/addresses page showing saved shipping and billing address cards with Set as Default and Delete actions_

> \[SCREENSHOT: Checkout showing saved address cards]

***

## My Companies

**My Companies** (`/account/organizations`) is where a signed-in customer sees the companies they can buy for and what each one gives them. Sales tax and credit terms come from the company, not from the customer's personal account, so this page is the customer-facing answer to "why is this order taxed?" and "why can't I bill this to the company?".

Every company listed is one the customer is a **member** of. A contact a rep merely associated with a company in HubSpot is not a member and does not appear here. See [Entitlement Request Workflows](entitlement-request-workflows.md) for how membership is granted.

The page shows a card per company with up to three lines:

| Line | What it says |
| --- | --- |
| **Sales tax** | The exempt states when the company holds an exemption ("Tax exempt on orders shipped to NC, SC. Sales tax still applies everywhere else."), or that sales tax applies. |
| **Credit terms (NET30)** | Whether the customer can bill this company account at checkout. When they cannot, the message names the reason: the company is not set up to pay on account, its credit terms are due for revalidation (with the date), or the account is no longer linked to the company. Each reason points at the account manager rather than a generic failure. |
| **Partner pricing** | Shown only when the company holds Trusted Installer status. Partner pricing applies to orders the customer places for that company. |

A customer with no company memberships sees a single notice: _"Your account is not linked to a company. Orders you place are billed to you personally."_

Every answer on this page is resolved through the same functions checkout and the credit gate use, so the page cannot offer something the order endpoint would then refuse.

> \[SCREENSHOT: The /account/organizations My Companies page showing a company card with its Sales tax, Credit terms (NET30), and Partner pricing lines - images/customer-accounts-my-companies.png]

***

## Account Lifecycle — How Data Flows

### Path A: Sales-Initiated (most B2B customers)

Path A Sales-created HubSpot contacts automatically become SCW customer accountsB2B defaultHubSpot ContactSales rep creates Contact Auto-provisionCognito user, local customer row, and welcome email Quote linkRep builds quote and sends payment link Checkout + fulfillmentOrder links to Contact; ShipEdge receives order if invoicedAuto-provisioning (and the welcome email) is gated OFF by default — it runs only when `HUBSPOT_WEBHOOK_AUTOPROVISION=true` (and `HUBSPOT_WEBHOOK_WELCOME_EMAIL=true`) is set. Credit terms are managed in the SCW admin panel (Admin → Credit Terms) and mirrored out to HubSpot — not the reverse. When an admin approves credit terms in SCW, the PO option appears at checkout for that customer immediately.

### Path B: Self-Service (website registration)

Path B Self-service customers start local, then sync to HubSpot on first orderWebsiteRegisterCustomer registers on SCW Commerce Local accountCognito user and local customer profile are created First orderHubSpot Contact is created or matched Linked orderEcommerce Order links to Contact and local customerId
