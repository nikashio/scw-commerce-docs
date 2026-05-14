# Customer Account Flows

## Overview

SCW Commerce uses **AWS Cognito** for authentication and a local **PostgreSQL** database for customer profiles. Customers migrated from Magento go through a one-time password reset flow.

---

## Customer Login

### New Customers (created on SCW Commerce)

1. Customer clicks **Sign In** or navigates to `/login`
2. Enters email and password
3. Cognito authenticates → NextAuth creates a session (30-day max)
4. Customer is redirected to their account page

> [SCREENSHOT: Login page]

### Migrated Customers (from Magento)

Customers migrated from Magento have a special first-login flow:

1. Customer enters their email on the login page
2. The system detects their Cognito status is `FORCE_CHANGE_PASSWORD` (migrated account)
3. Instead of an error, the customer sees an info message: *"Your account has been migrated. Please reset your password."* with a **"Reset Your Password →"** link
4. Customer clicks the link → taken to `/reset-password?migrated=true`
5. A verification code is sent to their email
6. Customer enters the code and their new password
7. After reset, they can log in normally going forward

> [SCREENSHOT: Login page showing migrated customer message with reset link]

> [SCREENSHOT: Reset password page]

---

## Customer Registration

### Self-Registration (customer-initiated)

1. Customer clicks **Create Account** or navigates to `/register`
2. Fills in: First Name, Last Name, Email, Password
3. Account created in Cognito + local database
4. Customer is logged in automatically

> [SCREENSHOT: Registration page]

### Auto-Provisioned by Sales Rep (via HubSpot webhook)

When a sales rep creates a new Contact in HubSpot, the customer account is **automatically created** in SCW Commerce within seconds:

1. Rep creates a Contact in HubSpot (enters email, name, company, etc.)
2. HubSpot fires a webhook to SCW Commerce (`POST /api/webhooks/hubspot/contact`)
3. SCW Commerce:
   - Fetches the full contact details from HubSpot API
   - Creates a Cognito login account (with temporary password)
   - Creates a customer record in the local database, linked to the HubSpot Contact
   - Sends a welcome email: **"Your SCW Account Has Been Created"** with a "Set Your Password" button
4. The customer can set their password whenever they want — no urgency
5. The sales rep can immediately use Payment Links or the Quote Builder for this customer

**What the customer receives:**
- A welcome email explaining their account was created by their sales representative
- A link to set their password at `/reset-password`

**What the rep can do immediately:**
- Build a quote and generate a payment link for the customer
- Check out on behalf of the customer (the order is assigned to the customer's record)

### Property Sync (real-time via webhook)

When a rep updates a Contact in HubSpot, the HubSpot private app (**"Frantic-Actor / claude code key"**, app id `35018267` on portal `51265320`) fires a signed webhook at **`POST https://hubspot.getscw.com/api/webhooks/hubspot/contact`**. SCW Commerce verifies the signature, dedupes events, and updates the matching `customers` row.

| HubSpot Property | SCW Commerce Field | Webhook Subscribed? | Handler? |
|---|---|---|---|
| `email` | `customers.email` | ✅ | ✅ |
| `firstname` | `customers.firstName` | ✅ | ✅ |
| `lastname` | `customers.lastName` | ✅ | ✅ |
| `company` | `customers.company` | ❌ not subscribed — add in HubSpot if needed | ✅ |
| `phone` | `customers.phone` | ❌ not subscribed — add in HubSpot if needed | ✅ |
| `approved_for_credit_terms` | `customers.approvedForCreditTerms` | ✅ | ✅ |
| `credit_limit` | `customers.creditLimit` | ✅ | ✅ |
| `tax_exemption_type` | `customers.exemptionType` + TaxJar Customer API | Subscription must be active in HubSpot | ✅ |
| `tax_exempt_regions` | `customers.exemptRegions` + TaxJar Customer API | Subscription must be active in HubSpot | ✅ |

Properties not in the list above **are not synced**. Daily reconciliation jobs cover credit terms and tax-exemption fields; profile fields flow only through the webhook. If a sales rep edits something outside this list, it stays in HubSpot.

### Viewing & Editing Webhook Subscriptions

1. HubSpot → gear icon (Settings) → **Integrations → Private Apps**
2. Open the **"Frantic-Actor / claude code key"** app
3. **Webhooks** tab → scroll to **Event subscriptions → Contact**
4. To add a new property subscription: **Create subscription** → Object type: *Contact* → Event: *Property change* → pick the property → Save, then **Activate** at the top.

Direct link (sandbox portal): `https://app.hubspot.com/private-apps/51265320/35018267/webhooks`

> **Error counts shown in the HubSpot webhooks tab** (e.g., 19/28 errors on `email` changes) indicate events where SCW Commerce returned a non-200. Common causes: signature clock drift, timeouts, or the matching customer row not existing yet. Check `/logs/api.log` on staging for the matching `event=webhook_contact_error` entries when triaging.

### Contact Deletion

When a Contact is deleted in HubSpot, the customer account is **NOT deleted** (they may have order history). The HubSpot link is removed (`hubspotContactId` set to null).

### When Does the Customer Get a HubSpot Contact?

There are two paths:

**Path A (sales-initiated):** The rep creates the Contact in HubSpot first → webhook auto-creates the SCW account. The HubSpot Contact exists from the start.

**Path B (self-registration):** The customer registers on the website → a HubSpot Contact is created when they place their **first order**. At checkout, the system:
1. Checks if a HubSpot Contact exists for this email
2. If not, creates one
3. Associates the Ecommerce Order with the Contact

---

## Password Reset

1. Customer clicks **Forgot Password?** on the login page
2. Enters their email
3. Cognito sends a verification code to the email
4. Customer enters the code and new password on `/reset-password`
5. Password updated — customer can log in with the new password

> [SCREENSHOT: Forgot password form]

---

## My Account Dashboard

After logging in, the customer can access their account at `/account`:

> [SCREENSHOT: My Account page showing sidebar navigation]

### Account Sections

| Section | Path | What It Shows |
|---|---|---|
| **My Account** | `/account` | Overview with contact info and default addresses |
| **My Orders** | `/account/orders` | All orders with status, date, total |
| **Address Book** | `/account/addresses` | Saved shipping and billing addresses |
| **Account Information** | `/account/info` | Edit name, email |
| **Change Password** | `/account/change-password` | Update password via Cognito |

---

## Order History

The **My Orders** page shows all orders associated with the customer's account:

| Column | Description |
|---|---|
| **Order #** | Order number (e.g., `SCW-20260406-A1B2`) |
| **Date** | When the order was placed |
| **Ship To** | Shipping address (if available) |
| **Order Total** | Grand total |
| **Status** | Current status (Processing, Shipped, Delivered, Cancelled, Pending Payment) |
| **Action** | "View Order" link to order detail page |

> [SCREENSHOT: My Orders page with several orders in different statuses]

### Order Detail Page

Click **View Order** to see:
- Full order summary (items, quantities, prices)
- Shipping and billing addresses
- Payment method used
- Order status
- Tracking information (if shipped)

> [SCREENSHOT: Order detail page]

### Which Orders Appear Here?

- Orders placed by the customer directly (credit card checkout)
- Orders placed by a sales rep on behalf of the customer (via payment link)
- Historical orders migrated from Magento (order numbers like `1068857454`)
- **Offline payment orders** (Check, Wire, PO) — these show with status "Pending Payment" until the admin invoices them

---

## Address Book

Customers can save multiple shipping and billing addresses:

1. Navigate to **Address Book** → `/account/addresses`
2. Click **Add New Address**
3. Fill in the address form
4. Select **Default Shipping** and/or **Default Billing** if desired
5. Save

Saved addresses are available:
- At checkout (as selectable cards instead of manual entry)
- When a sales rep checks out on behalf of the customer (addresses load automatically)

> [SCREENSHOT: Address Book page with saved addresses]

> [SCREENSHOT: Checkout showing saved address cards]

---

## Account Lifecycle — How Data Flows

### Path A: Sales-Initiated (most B2B customers)

<section class="modern-flow" aria-label="Sales-initiated customer account lifecycle">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Path A</span>
      <span class="modern-flow__title">Sales-created HubSpot contacts automatically become SCW customer accounts</span>
    </div>
    <span class="modern-flow__badge">B2B default</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">HubSpot Contact<small>Sales rep creates Contact</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">Auto-provision<small>Cognito user, local customer row, and welcome email</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">Quote link<small>Rep builds quote and sends payment link</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">Checkout + fulfillment<small>Order links to Contact; ShipEdge receives order if invoiced</small></span>
  </div>
  <div class="modern-flow__note">When sales updates credit terms in HubSpot, the webhook updates SCW instantly and the PO option appears at checkout for that customer.</div>
</section>

### Path B: Self-Service (website registration)

<section class="modern-flow" aria-label="Self-service customer account lifecycle">
  <div class="modern-flow__header">
    <div>
      <span class="modern-flow__eyebrow">Path B</span>
      <span class="modern-flow__title">Self-service customers start local, then sync to HubSpot on first order</span>
    </div>
    <span class="modern-flow__badge">Website</span>
  </div>
  <div class="modern-flow__track">
    <span class="modern-flow__node modern-flow__node--start">Register<small>Customer registers on SCW Commerce</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--success">Local account<small>Cognito user and local customer profile are created</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--action">First order<small>HubSpot Contact is created or matched</small></span>
    <span class="modern-flow__arrow" aria-hidden="true"></span>
    <span class="modern-flow__node modern-flow__node--ship">Linked order<small>Ecommerce Order links to Contact and local customerId</small></span>
  </div>
</section>
