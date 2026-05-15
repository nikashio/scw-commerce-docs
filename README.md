# SCW Commerce — Admin & Sales Guide

Welcome to the SCW Commerce documentation. This guide is for **sales representatives** and **administrators** who work with Security Camera Warehouse's e-commerce platform and HubSpot CRM.

---

## Who This Guide Is For

| Role | What You'll Use This Guide For |
|---|---|
| **Sales Representative** | Building quotes, generating payment links, checking out on behalf of customers, managing credit terms |
| **Administrator** | Invoicing offline payment orders, reviewing purchase orders, monitoring order status, managing customer accounts |
| **Operations / Shipping** | Understanding how orders flow from checkout to ShipEdge fulfillment |

---

## Guide Structure

This guide follows the natural order of how work flows through the system — from building a quote to shipping a product.

### Foundations
1. [Platform Overview](platform-overview.md) — What SCW Commerce is, how the systems connect, and where your data lives
2. [Key Concepts](key-concepts.md) — The building blocks: Quotes, Orders, Invoices, Statuses, and how they relate to each other

### Sales Rep Workflow
3. [Quote Builder & Payment Links](quote-builder.md) — How to build quotes in HubSpot and generate checkout links
4. [Checkout & Payment Methods](checkout-payment-methods.md) — The four payment methods, what the customer sees, and what happens behind the scenes

### Order Management
5. [Order Lifecycle & Status Flow](order-lifecycle.md) — How an order moves from placement to delivery, and what triggers each status change
6. [Admin Actions — Invoicing & Order Management](admin-actions.md) — How to invoice offline payment orders and manage the fulfillment pipeline

### Configuration
7. [Credit Terms Management](credit-terms.md) — How to approve B2B customers for Purchase Order (NET30) payment
8. [Customer Accounts](customer-accounts.md) — Customer login, registration, password reset, and order history

### Developer Reference
9. [Make Automation Migration](make-automation-migration.md) — How the Make team should replace Magento 2 order triggers/lookups with SCW Commerce webhooks and APIs
10. [Admin API](api-admin.md) — Programmatic reference for internal admin endpoints
