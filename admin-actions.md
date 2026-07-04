# Admin Actions — Invoicing & Order Management

## Overview

For offline payment methods (Purchase Order, Check, Wire), the order sits in **Pending Payment** until an admin confirms the payment and invoices the order. This page covers the admin's day-to-day workflow.

***

## Finding Pending Payment Orders

### In HubSpot

1. Navigate to **Ecommerce Orders** from the top menu
2. Click **Filters** → **Status** → select **Pending**
3. The list shows all orders waiting for admin action

You can also add the **Payment Method Type** column to the table view:

1. Click **Edit columns**
2. Add **Payment Method Type** and **PO Number**
3. Save the view

![The HubSpot Ecommerce Orders list showing offline payment orders with their payment method types visible — use this view to identify orders waiting for admin invoicing.](.gitbook/assets/hubspot-orders-pending-filtered.png)

_Ecommerce Orders list — add the Payment Method Type column to quickly identify Check, Wire, and PO orders waiting for admin action._

### Identifying the Payment Type

| Payment Method Type | What to Do                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| `purchase_order`    | Verify the PO Number against the customer's credit limit, then invoice  |
| `check`             | Wait for the check to arrive and clear, then invoice                    |
| `ach_wire`          | Check the bank portal for the transfer (match by Order #), then invoice |
| `credit_card`       | Should not be in Pending — investigate if you see this                  |

***

## Invoicing an Order

When you've confirmed payment has been received (check cleared, wire arrived, PO approved):

### Step 1: Find the Order

Click on the Ecommerce Order in HubSpot to open the detail view.

Verify:

* **Status:** Pending
* **Payment Method Type:** The offline method used
* **PO Number:** (for Purchase Orders) — verify against the customer's credit limit
* **Total:** Matches the payment received

![An Ecommerce Order detail page in HubSpot showing the Order Actions panel with ORDER TOTAL, PAYMENT METHOD (purchase\_order), and INVOICES count — the left panel shows billing address fields and the right sidebar shows associated Contacts and Ecommerce Invoices.](.gitbook/assets/hubspot-order-pending-detail.png)

_An Ecommerce Order record — verify Status, Payment Method Type, PO Number, and Total before invoicing._

### Step 2: Invoice the Order

Call the invoice endpoint. This can be done via:

**Option A: HubSpot Invoice Button** _(if deployed in your portal)_

* Click the **"Invoice Order"** button on the Ecommerce Order record
* The button calls the SCW Commerce API automatically

**Option B: Direct API Call**

```
POST https://hubspot.getscw.com/api/admin/orders/{ORDER_ID}/invoice
```

Where `{ORDER_ID}` is the internal order ID (shown as `eo_source_id` on the Ecommerce Order). The endpoint also accepts the SCW order number (e.g., `1268879530`) when calling it directly.

The invoice endpoint accepts orders in either `pending_payment` or `pending` status.

![Ecommerce Order record showing the Data highlights section with ORDER ID — this is the eo\_source\_id value used in the invoice API call (e.g. POST /api/admin/orders/{ORDER\_ID}/invoice).](.gitbook/assets/hubspot-order-source-id.png)

_The Data highlights section shows ORDER ID (the internal database ID / eo\_source\_id), used when calling the invoice endpoint directly._

### Step 3: What Happens After Invoicing

When the invoice endpoint is called, the following happens automatically:

1. **Invoice created and marked paid** in SCW Commerce database
2. **Order status** changes from `pending_payment` → `processing`
3. **HubSpot Ecommerce Order** status updates to `processing`
4. **ShipEdge** receives the order for fulfillment
5. The shipping team can now pick, pack, and ship the order

From this point, the order follows the normal fulfillment flow — ShipEdge creates a shipping label, tracking syncs back, and the customer gets a shipping notification.

![An Ecommerce Order record showing the order after it has been invoiced — the order status shows Processing and an invoice is listed in the Invoices section.](.gitbook/assets/hubspot-order-processing.png)

_After invoicing, the order status moves to Processing and the Ecommerce Invoice appears in the sidebar._

***

## Cancelling an Order

### Automatic Cancellation (Check & Wire Only)

* **Check orders:** Automatically cancelled after **14 days** in Pending Payment
* **Wire orders:** Automatically cancelled after **21 days** in Pending Payment
* **Purchase Orders:** Never auto-cancelled — admin must act manually

This runs daily at 3 AM UTC. When an order is auto-cancelled:

* Status changes to `cancelled` in SCW Commerce
* HubSpot Ecommerce Order status updates to `cancelled`
* Because pending-payment orders have not been invoiced, they have not been pushed to ShipEdge

### Manual Cancellation

There is no public cancel button in the current documented admin workflow. For a manual cancellation before the auto-cancel deadline, use an internal admin/engineering status correction. If the order was already pushed to ShipEdge, coordinate the ShipEdge cancellation or stop-work separately.

***

## Reviewing a Purchase Order

When a PO order comes in:

1. **Check the PO Number** on the Ecommerce Order (`eo_po_number` property)
2. **Check the customer's credit limit** — go to the associated Contact, find "Credit Limit" property
3. **Verify the order total** doesn't exceed the credit limit
4. **Check existing open PO orders** for this customer — make sure total outstanding credit doesn't exceed the limit
5. If everything checks out, **invoice the order**

![A HubSpot Contact record showing the About this Contact section — scroll to the SCW custom properties to find Approved for Credit Terms and Credit Limit values to verify before invoicing a PO order.](.gitbook/assets/hubspot-contact-credit-approved.png)

_The Contact record — scroll the left panel to find the Approved for Credit Terms and Credit Limit properties before approving a PO order._

### Demo PO Orders

If a customer enters "demo" as the PO number, the order should still be processed normally. The admin team handles these by applying a special "Demo" template to the invoice rather than standard NET30 branding.

***

## Verifying a Wire Transfer

When a wire/ACH order comes in:

1. **Note the Order Number** from the Ecommerce Order (e.g., `1268879530` for current sequence-generated orders; older orders may use the earlier `ORD-000406` format, and Magento-migrated orders use a numeric string or the legacy `SCW-YYYYMMDD-XXXX` format)
2. **Check the bank portal** for an incoming transfer with that order number in the memo
3. **Verify the amount** matches the order total
4. If funds are confirmed, **invoice the order**
5. If the customer emailed a remittance advice, that can serve as additional confirmation

***

## Verifying a Check

When a check order comes in:

1. **Wait for the physical check** to arrive at: 11 Richland Street, Asheville, NC 28806
2. **Verify the check amount** matches the order total
3. **Verify the order number** is referenced on the check
4. **Deposit the check** and wait for it to clear
5. Once cleared, **invoice the order**

> **Important:** Do not move a check order to `processing` just to avoid auto-cancellation. `processing` means payment has been confirmed and fulfillment can begin. If a check needs more time to clear near the 14-day deadline, leave the order in `pending_payment` and escalate for an admin/engineering extension instead of bypassing the invoice workflow.

***

## Tax Exemptions (View Only)

The **Tax Exemptions** page is accessible under the **Operations** group in the admin navigation at `/admin/tax-exemptions`.

### What it shows

| Column         | Description                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email          | Email address of the exempt customer                                                                                                                                                                                   |
| Name           | First and last name of the exempt customer                                                                                                                                                                             |
| Exemption Type | `wholesale`, `government`, or `other`                                                                                                                                                                                  |
| Exempt Regions | The US states where tax exemption applies                                                                                                                                                                              |
| Source         | Provenance of the exemption: `admin` (set via the admin exemption-request approval flow), `org` (set via an org-level email-domain rule), or `hubspot_legacy` (migrated from the old HubSpot-managed exemption system) |
| Validated By   | The person or system that validated the exemption document                                                                                                                                                             |
| Document       | A "View" link to the supporting document (e.g., the uploaded reseller certificate). Shows "—" when no document is on file                                                                                              |

### Important: view only

This page is read-only. Exemptions cannot be created, edited, or removed directly on this page. All changes go through the **Exemption Requests** workflow: admins submit a request at `/admin/tax-exemption-requests`, upload supporting documents, and approve or reject via the admin approval flow (`POST /api/admin/tax-exemption-requests/[id]/approve` or `/reject`). There is no `POST /api/webhooks/tax-exemption` endpoint.

![The SCW Admin Tax Exemptions page showing the table with Email, Name, Type, Regions, Source, Validated By, and Document columns.](.gitbook/assets/admin-tax-exemptions-list.png)

_The SCW Admin Tax Exemptions page showing the table with Email, Name, Type, Regions, Source, Validated By, and Document columns._

***

## Quick Reference: Admin Actions by Payment Method

| Scenario                                            | Action                                                                   | Result                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| PO order received, PO verified                      | Invoice the order                                                        | Status → Processing → Ships                    |
| Check received and cleared                          | Invoice the order                                                        | Status → Processing → Ships                    |
| Wire transfer confirmed in bank                     | Invoice the order                                                        | Status → Processing → Ships                    |
| Check not received in 14 days                       | Nothing — auto-cancels                                                   | Status → Cancelled                             |
| Wire not received in 21 days                        | Nothing — auto-cancels                                                   | Status → Cancelled                             |
| Customer wants to cancel                            | Escalate for internal admin/engineering cancellation                     | Status → Cancelled                             |
| Check arrived but not cleared, 14-day deadline near | Escalate for deadline extension; do not move to Processing until cleared | Avoids bypassing invoice and ShipEdge workflow |
