# Order Lifecycle & Status Flow

## Overview

Every order moves through a defined set of statuses. Each status transition is triggered by a specific event — either automatic (system) or manual (admin action).

---

## Status Flow Diagram

```
                          ┌─────────────────────────────────┐
                          │          ORDER PLACED            │
                          └──────────────┬──────────────────┘
                                         │
                          ┌──────────────▼──────────────────┐
                          │           pending                │
                          │      (order just created)        │
                          └──────────────┬──────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
          Credit Card              Offline Methods       Auth-Only
                    │              (Check/Wire/PO)        (rare)
                    ▼                    ▼                     ▼
            ┌──────────┐      ┌─────────────────┐    ┌──────────────┐
            │   paid    │      │ pending_payment  │    │  authorized  │
            │           │      │                  │    │              │
            │  Payment  │      │  Waiting for     │    │  Card held,  │
            │  charged  │      │  admin to        │    │  not charged │
            └─────┬─────┘      │  invoice         │    └──────┬───────┘
                  │            └────────┬─────────┘           │
                  │                     │                     │
                  │            Admin clicks                Admin
                  │            "Invoice"                   "Capture"
                  │                     │                     │
                  │                     ▼                     ▼
                  │            ┌──────────────┐        ┌──────────┐
                  └───────────►│  processing   │◄───────│   paid   │
                               │              │        └──────────┘
                               │  ShipEdge    │
                               │  has the     │
                               │  order       │
                               └──────┬───────┘
                                      │
                              ShipEdge creates
                              shipping label
                                      │
                                      ▼
                               ┌──────────────┐
                               │   shipped     │
                               │              │
                               │  Tracking #  │
                               │  assigned    │
                               └──────┬───────┘
                                      │
                              Carrier delivers
                                      │
                                      ▼
                               ┌──────────────┐
                               │  delivered    │
                               └──────────────┘


    ╔══════════════════════════════════════════════════╗
    ║  Any status except delivered can → cancelled     ║
    ║  (manual cancel or auto-cancel for Check/Wire)  ║
    ╚══════════════════════════════════════════════════╝
```

---

## Status Definitions

| Status | Meaning | Who Triggers It | What's Happening |
|---|---|---|---|
| `pending` | Order just created, payment not yet attempted | System (automatic) | Exists for milliseconds before payment result |
| `pending_payment` | Waiting for offline payment (Check, Wire, or PO) | System (automatic for offline methods) | Admin must invoice to proceed. **ShipEdge does NOT have this order.** |
| `authorized` | Card authorized but not charged (auth-only mode) | System (rare — only for auth-only transactions) | Admin must capture to proceed |
| `paid` | Payment successfully charged | System (Authorize.net confirms) | About to go to ShipEdge |
| `processing` | Order accepted by ShipEdge, in the warehouse queue | System (ShipEdge confirms) or Admin (invoices offline order) | Warehouse team is picking & packing |
| `shipped` | Shipping label created, package handed to carrier | ShipEdge sync (automatic, checked every 5 minutes) | Customer receives shipping notification email |
| `delivered` | Carrier confirms delivery | ShipEdge sync (automatic) | Order complete |
| `cancelled` | Order cancelled | Admin (manual) or System (auto-cancel for Check/Wire) | No further action |

---

## How Statuses Appear in HubSpot

The SCW Commerce status is mapped to HubSpot Ecommerce Order status:

| SCW Commerce Status | HubSpot `eo_status` | Notes |
|---|---|---|
| `pending` | `pending` | Brief transitional state |
| `pending_payment` | `pending` | **This is the one admins will see for offline orders** |
| `paid` | `processing` | Mapped because HubSpot doesn't have a `paid` option |
| `authorized` | `processing` | Same mapping |
| `processing` | `processing` | Direct match |
| `shipped` | `shipped` | Direct match |
| `delivered` | `delivered` | Direct match |
| `cancelled` | `cancelled` | Direct match |

> [SCREENSHOT: Ecommerce Orders list in HubSpot showing different statuses]

---

## Status Transitions — What Triggers Each Change

### Credit Card Flow (Automatic)

```
pending → paid → processing → shipped → delivered
```

| Transition | Trigger | Timing |
|---|---|---|
| pending → paid | Authorize.net returns approval | Instant (at checkout) |
| paid → processing | ShipEdge accepts the order | ~1 second after checkout |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships (checked every 5 min) |
| shipped → delivered | Carrier confirms delivery | When delivered (checked every 5 min) |

**No admin action required.** The entire flow is automatic.

### Offline Payment Flow (Requires Admin)

```
pending → pending_payment → [ADMIN INVOICES] → processing → shipped → delivered
```

| Transition | Trigger | Timing |
|---|---|---|
| pending → pending_payment | Offline method selected at checkout | Instant (at checkout) |
| pending_payment → processing | **Admin invokes Invoice** | When admin confirms payment received |
| processing → shipped | ShipEdge creates shipping label | When warehouse ships |
| shipped → delivered | Carrier confirms delivery | When delivered |

**Admin action required at the `pending_payment → processing` step.** See [Admin Actions](admin-actions.md).

### Auto-Cancellation

| Order Type | Auto-Cancel After | What Happens |
|---|---|---|
| Check / Money Order | **14 days** in `pending_payment` | Status → `cancelled`, inventory released |
| ACH / Wire Transfer | **21 days** in `pending_payment` | Status → `cancelled`, inventory released |
| Purchase Order (NET30) | **Never** | Stays in `pending_payment` until admin acts |
| Credit Card | **Never** | Payment is immediate |

The auto-cancel process runs daily at 3 AM UTC.

---

## Where to See Order Status

### In HubSpot
- Navigate to **Ecommerce Orders** in the top navigation
- The **Status** column shows the current status
- Click any order to see full details

> [SCREENSHOT: HubSpot Ecommerce Orders list view with Status column]

### In Customer's Account (Storefront)
- Customer logs in at `hubspot.getscw.com/account`
- Click **My Orders**
- Status column shows: Processing, Shipped, Delivered, Cancelled, etc.

> [SCREENSHOT: Customer's My Orders page showing order statuses]

### In the Database (Technical)
- `orders` table → `status` column
- `orders` table → `payment_method` column (credit_card, purchase_order, check, ach_wire)
- `orders` table → `po_number` column (for PO orders)
