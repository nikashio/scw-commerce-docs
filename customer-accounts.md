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

1. Customer clicks **Create Account** or navigates to `/register`
2. Fills in: First Name, Last Name, Email, Password
3. Account created in Cognito + local database
4. Customer is logged in automatically

> [SCREENSHOT: Registration page]

### When Does the Customer Get a HubSpot Contact?

A HubSpot Contact is **not** created at registration. It is created when the customer places their **first order**. At checkout, the system:
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

```
Customer registers on SCW Commerce
  │
  ├── Cognito: user created (handles passwords)
  ├── Local DB: customer record created (profile, addresses)
  └── HubSpot: Contact NOT created yet
         │
         ▼
Customer places first order
  │
  ├── HubSpot: Contact created (or matched if already exists)
  ├── HubSpot: Ecommerce Order created, linked to Contact
  └── Local DB: order linked to customer via customerId
         │
         ▼
Sales rep approves for credit terms (in HubSpot)
  │
  ├── HubSpot: Contact property updated (approved_for_credit_terms = true)
  └── Daily sync: local DB updated → PO option appears at checkout
```
