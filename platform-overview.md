# Platform Overview

## What is SCW Commerce?

SCW Commerce is Security Camera Warehouse's e-commerce platform. It replaces the legacy Magento storefront with a modern system built on Next.js, integrated with HubSpot CRM for sales workflows, ShipEdge for fulfillment, Authorize.net for payments, and TaxJar for tax calculation.

The platform supports both **self-service** (customer buys directly on the website) and **sales-assisted** (rep builds a quote in HubSpot and checks out on behalf of the customer) workflows.

---

## The Systems

SCW Commerce is not a single application — it's a set of connected systems, each responsible for a specific part of the business. Understanding what each system does (and doesn't do) is the key to using the platform effectively.

### SCW Commerce Storefront
**What it is:** The customer-facing website where products are browsed, carts are built, and checkout happens.
**URL:** `https://hubspot.getscw.com` (staging)
**Who uses it:** Customers directly, or sales reps on behalf of customers.
**What it stores:** Orders, invoices, shipments, customer accounts, addresses, carts, product catalog.

### HubSpot CRM
**What it is:** The sales team's workspace. Where contacts, quotes, orders, and invoices live for the sales and admin team.
**Who uses it:** Sales reps and administrators.
**What it stores:** Contacts, Ecommerce Quotes, Ecommerce Orders, Ecommerce Invoices, Ecommerce Shipments, Ecommerce Line Items, Ecommerce Credit Memos.
**Key tool:** The **Quote Builder** — a custom HubSpot card where reps build quotes and generate payment links.

### ShipEdge (WMS / Fulfillment)
**What it is:** The warehouse management system. When an order is ready to ship, it's pushed to ShipEdge where the warehouse team picks, packs, and ships it.
**Who uses it:** Warehouse / operations team.
**What it stores:** Inventory levels, order fulfillment status, tracking numbers, shipment data.
**Important:** SCW Commerce checks ShipEdge for real-time stock availability. ShipEdge is the **source of truth** for inventory.

### Authorize.net (Payment Gateway)
**What it is:** Processes credit card payments. Card data goes directly from the customer's browser to Authorize.net — it never touches SCW servers.
**Who uses it:** Automatic — no manual interaction needed.
**Note:** Only used for **credit card** payments. Offline methods (Check, Wire, PO) bypass Authorize.net entirely.

### TaxJar (Tax Calculation)
**What it is:** Calculates sales tax based on the shipping destination. SCW has tax nexus in 29 states.
**Who uses it:** Automatic — tax is calculated at checkout and when quotes are saved with a shipping address.

---

## How the Systems Connect

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HUBSPOT CRM                                 │
│                                                                     │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │   Contacts    │    │ Ecommerce Quotes │    │ Ecommerce Orders │   │
│  │              │    │ (Quote Builder)  │    │ (Order tracking) │   │
│  └──────────────┘    └────────┬─────────┘    └────────▲─────────┘   │
│                               │                       │             │
│                    Generate    │              Order     │             │
│                  Payment Link  │              synced    │             │
│                               │              back      │             │
└───────────────────────────────┼────────────────────────┼─────────────┘
                                │                        │
                                ▼                        │
┌─────────────────────────────────────────────────────────────────────┐
│                     SCW COMMERCE STOREFRONT                         │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │  Product  │   │   Cart   │   │ Checkout │   │    Orders     │    │
│  │  Catalog  │   │          │   │          │   │  & Invoices   │    │
│  └──────────┘   └──────────┘   └─────┬────┘   └──────┬───────┘    │
│                                      │               │             │
│                          ┌───────────┼───────────┐   │             │
│                          │           │           │   │             │
│                          ▼           ▼           ▼   │             │
│                   ┌───────────┐ ┌────────┐ ┌───────┐ │             │
│                   │Authorize  │ │ TaxJar │ │ No    │ │             │
│                   │.net       │ │        │ │Payment│ │             │
│                   │(CC only)  │ │(tax)   │ │(PO,   │ │             │
│                   │           │ │        │ │Check, │ │             │
│                   │           │ │        │ │Wire)  │ │             │
│                   └───────────┘ └────────┘ └───────┘ │             │
│                                                      │             │
│                                    ┌─────────────────┘             │
│                                    │ Order ready to ship?          │
│                                    │ (status = processing)         │
│                                    ▼                               │
└────────────────────────────────────┼───────────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────────┐
                    │          SHIPEDGE (WMS)             │
                    │                                    │
                    │  Receives order → Warehouse picks  │
                    │  → Packs → Creates shipping label  │
                    │  → Tracking # syncs back to SCW    │
                    │                                    │
                    │  Also provides:                    │
                    │  • Real-time inventory levels      │
                    │  • Shipment tracking data          │
                    └────────────────────────────────────┘
```

> [SCREENSHOT: This is a good place for a Loom video — "2 minute overview of how the systems work together"]

---

## The Two Main Workflows

### Self-Service (Customer Buys Directly)

```
Customer browses website → Adds to cart → Checkout → Pays → Order ships
```

The customer does everything themselves. No rep involvement. This is the standard e-commerce flow.

### Sales-Assisted (Rep Builds Quote)

```
Rep builds quote in HubSpot → Generates payment link → 
  Either:
    A) Sends link to customer → Customer checks out
    B) Rep opens link and checks out on behalf of customer (e.g., phone order)
→ Order ships
```

The rep uses the **Quote Builder** in HubSpot to configure products, set prices, and generate a payment link. The link takes the customer (or the rep) to a pre-loaded checkout. This is used for B2B sales, phone orders, and custom pricing.

---

## Where Does Data Live?

This is important to understand. The same order exists in multiple systems, but each system has a different role:

| Data | Source of Truth | Also Exists In | Notes |
|---|---|---|---|
| **Customer account** (login, password) | AWS Cognito | — | Passwords are managed by Cognito, never stored locally |
| **Customer profile** (name, email, addresses) | SCW Commerce DB | HubSpot (as Contact) | Profile is local, Contact is synced on first order |
| **Product catalog** (SKUs, prices, descriptions) | SCW Commerce DB | HubSpot (as Products) | Synced every 15 minutes |
| **Inventory / stock levels** | ShipEdge | — | Real-time check on add-to-cart and checkout |
| **Quotes** | HubSpot (Ecommerce Quotes) | — | Quotes only exist in HubSpot |
| **Orders** | SCW Commerce DB | HubSpot (Ecommerce Orders) | Created locally, synced to HubSpot |
| **Invoices** | SCW Commerce DB | HubSpot (Ecommerce Invoices) | Created locally, synced to HubSpot |
| **Shipments / Tracking** | ShipEdge | SCW Commerce DB + HubSpot | ShipEdge creates, synced every 5 minutes |
| **Tax calculation** | TaxJar | — | Calculated in real-time, not stored permanently |
| **Credit terms approval** | HubSpot (Contact property) | SCW Commerce DB | Set in HubSpot, synced daily to storefront |

---

## Automatic Sync Processes

The systems stay in sync through automated processes that run on a schedule:

| Process | Frequency | What It Does |
|---|---|---|
| **Product sync** | Every 15 minutes | Syncs product catalog changes between HubSpot and storefront |
| **ShipEdge order status sync** | Every 5 minutes | Checks ShipEdge for status changes (shipped, delivered) and updates storefront + HubSpot |
| **Credit terms sync** | Daily at 2 AM UTC | Syncs "Approved for Credit Terms" and "Credit Limit" from HubSpot Contacts to storefront |
| **Auto-cancel stale orders** | Daily at 3 AM UTC | Cancels Check orders older than 14 days and Wire orders older than 21 days |
| **DLQ retry** | Every 5 minutes | Retries failed sync operations (HubSpot API errors, etc.) |

These processes are fully automatic — no manual intervention needed unless something fails (which is logged and retried automatically).
