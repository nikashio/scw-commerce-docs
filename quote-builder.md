# Quote Builder & Payment Links

## Overview

The Quote Builder is a HubSpot CRM extension that lets sales reps create quotes, configure products, and generate payment links — all without leaving HubSpot. When a customer is ready to pay, the rep generates a payment link that takes the customer (or the rep) directly to checkout with all products pre-loaded.

---

## Where to Find the Quote Builder

The Quote Builder lives on the **Ecommerce Quote** object in HubSpot.

1. Navigate to a **Contact** record in HubSpot
2. In the right sidebar, find **Ecommerce Quotes**
3. Click **+ Add** to create a new quote, or click an existing quote
4. The **Quote Builder** tab appears on the Ecommerce Quote record

> [SCREENSHOT: HubSpot Contact record showing Ecommerce Quotes section in sidebar]

> [SCREENSHOT: Ecommerce Quote record with Quote Builder tab visible]

---

## Building a Quote

### Adding Products

1. Click **Add Products** in the Quote Builder
2. Search for a product by name or SKU
3. Select the product — if it has configurable options (size, color, etc.), a modal appears to select them
4. Set the quantity and price
5. The product is added to the quote's line items

> [SCREENSHOT: Product search panel in Quote Builder]

> [SCREENSHOT: Product options modal (if applicable)]

### Editing Line Items

Each line item in the quote shows:
- **Item name** and SKU
- **Quantity**
- **Sell Price** (editable — this is the quoted price)
- **Total** (qty x price)
- **Actions** — Edit or Remove

Click **Edit** on any line item to change the quantity, price, or apply a line-level discount.

> [SCREENSHOT: Quote Builder with line items showing Edit button]

### Quote Summary

The right side of the Quote Builder shows:
- **Subtotal** — sum of all line items
- **Tax** — calculated automatically if a shipping address is set (via TaxJar)
- **Discount** — quote-level discount (click "Edit discount" to apply)
- **Total** — final amount the customer will pay

> [SCREENSHOT: Quote summary panel showing subtotal, tax, discount, total]

### Customer Address

The Quote Builder can auto-populate the customer's billing and shipping address from their HubSpot Contact record. The address is used for:
- Tax calculation (TaxJar needs a shipping address)
- Pre-filling the checkout form when the payment link is opened

> [SCREENSHOT: Address picker panel in Quote Builder]

---

## Generating a Payment Link

Once the quote is complete:

1. Click **Payment Link** button
2. The system validates the quote and generates a checkout URL
3. The payment link appears with **Open** and **Copy** buttons

> [SCREENSHOT: Payment Link section showing "Ready" status with Open and Copy buttons]

### What Happens When the Link is Generated

Behind the scenes:
1. The Quote Builder sends the line items, prices, and customer email to the SCW Commerce backend
2. A cart is created in the SCW Commerce database with:
   - All products at the quoted prices (prices are **locked** — they won't change even if the catalog price updates)
   - The customer's email (from the associated HubSpot Contact)
   - A link back to the Ecommerce Quote ID
3. The URL is saved to the `eq_payment_link` property on the Ecommerce Quote

### Two Ways to Use the Payment Link

#### Option 1: Send to Customer
Copy the link and send it to the customer via email, chat, or any channel. The customer opens the link, sees the pre-loaded cart, enters their shipping address and payment info, and completes checkout.

#### Option 2: Rep Checks Out on Behalf of Customer
The rep opens the link themselves (e.g., while on a phone call with the customer). The checkout page:
- Pre-fills the customer's email
- Loads the customer's **saved addresses** from their account (if they have one)
- The rep selects the shipping address, enters the customer's credit card (or selects an offline payment method), and completes the order

The order is associated with the **customer's account** (not the rep's), so it appears in the customer's order history.

> [SCREENSHOT: Checkout page opened from payment link showing customer's saved addresses]

---

## What Gets Created in HubSpot

After a successful checkout from a payment link:

| HubSpot Object | What Happens |
|---|---|
| **Ecommerce Order** | Created automatically with order number, status, totals, addresses |
| **Ecommerce Quote ↔ Order** | Association created — you can see the order on the quote and vice versa |
| **Contact** | Order is associated with the contact |
| **Ecommerce Line Items** | Each product in the order is created as a line item |
| **Ecommerce Invoice** | Created if payment was processed immediately (credit card) |

> [SCREENSHOT: Ecommerce Quote showing linked Ecommerce Order in sidebar]

> [SCREENSHOT: Ecommerce Order showing linked Ecommerce Quote in sidebar]

---

## Important Notes

- **Payment links expire after 30 days.** If the customer doesn't use it in time, the rep needs to generate a new one.
- **Each payment link creates a new cart.** If the rep generates multiple links for the same quote, only the latest one should be used.
- **Prices are locked.** The checkout uses the exact prices from the quote, not the current catalog prices. If a product's price changes after the quote is built, the customer still pays the quoted price.
- **A contact must be associated with the quote.** The system requires a contact email to generate the payment link. If no contact is associated, the link generation will fail with an error message.
