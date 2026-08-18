# Orders

## Overview

An order records a customer purchase and tracks its progression from placement through fulfillment. It carries an order number, an order date, a currency, a pricing breakdown (subtotal, tax, discount, shipping, total), shipping and billing addresses, payment metadata, and a set of line items snapshotting the products bought. The same record backs a customer's cart before purchase — a cart is an order in `cart` status — so checkout advances a record rather than creating a second one.

Orders are reachable two ways: a management surface used by other services and internal tools, which reaches every order regardless of owner, and a customer-facing order history, which returns only the signed-in customer's placed orders and renders each with an expandable detail view.

This specification covers the order entity, its status lifecycle, its line items, the management surface, and the customer order-history surface. The pre-purchase `cart` state and everything that mutates a cart are owned by `cart.md`; the transition from cart to placed order, including permanent order-number assignment, is owned by `checkout.md`; the transition to `paid` is owned by `payment-webhooks.md`; the addresses stored on an order are owned by `checkout.md` and `saved-addresses.md`; session authentication is owned by `auth.md`.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define the order entity, its observable field contract, and its pricing breakdown
- Define the closed status vocabulary and which specs own which transitions
- Define the line-item contract and the product data a line item snapshots
- Define the management surface: create, read, update, delete, and list with filtering
- Define the customer order-history surface and the ownership isolation that governs it
- Define the uniqueness, precision, and required-field limits the order enforces

### Non-Goals

- Cart mutation and the guest cart lifecycle (`cart.md`)
- Placing an order from a cart, and order-number assignment (`checkout.md`)
- Payment capture and the transition to `paid` (`payment-webhooks.md`)
- Fulfillment and shipping workflows, carrier tracking, and delivery notifications
- Inventory management and stock reservation
- Order approval workflows and order-to-invoice conversion
- Cancelling, modifying, or reordering from the customer order-history surface — it is view-only
- Guest order history — orders placed before the customer had an account are not shown
- Filtering, sorting, or paginating the customer order-history surface beyond newest-first
- Invoice and receipt download, and order-status email notification
- Soft delete and audit history for orders

## Functional Requirements

### FR-1: Order Identity

- An order SHALL carry a system-generated identifier, a globally unique `orderNumber`, an `orderDate`, a `currency`, a `subtotal`, and a `totalAmount` (LIM-1, LIM-4).
- An order SHALL carry the pricing components `taxAmount`, `discountAmount`, and `shippingAmount`, each defaulting to zero (LIM-5).
- An order MAY carry a `referenceNumber` (an external reference such as a customer purchase-order number), an `expectedDeliveryDate`, a `shippingAddress`, a `billingAddress`, `paymentTerms`, internal `notes`, and `customerNotes` shown to the customer.
- An order MAY carry a `paidAt` timestamp and a `paymentTransactionId` recording the payment provider's transaction (CON-4).
- An order MAY be associated with the customer who owns it; an order with no such association is a guest order and SHALL NOT appear in any customer's order history (FR-9).
- An order SHALL carry `createdAt` and `updatedAt` timestamps, both system-assigned.

### FR-2: Order Status

- An order SHALL carry a `status` drawn from a single closed vocabulary: `cart`, `draft`, `confirmed`, `processing`, `shipped`, `fulfilled`, `paid`, and `cancelled` (LIM-2).
- `cart` SHALL denote a pre-purchase cart rather than a placed order; carts SHALL be excluded from every order-history surface (`cart.md`, LIM-8).
- An order created directly through the management surface SHALL default to `draft`.
- The transition from `cart` to `confirmed` SHALL be owned by checkout (`checkout.md` FR-3) and the transition to `paid` by payment processing (`payment-webhooks.md` FR-3); this specification does not otherwise constrain the order in which statuses are reached.

### FR-3: Order Line Items

- An order SHALL carry zero or more line items, each referencing one product and carrying a quantity, a unit price, a currency, and snapshots of the product's name, SKU, and image reference.
- A line item's snapshotted values SHALL be captured when the item is added and SHALL NOT change when the product is later edited (`cart.md` LIM-5).
- An order SHALL carry at most one line item per product (`cart.md` LIM-3).
- A line item's line total SHALL be its unit price multiplied by its quantity.
- An order with no line items SHALL be returned with an empty item set rather than an error, so a data inconsistency is visible rather than fatal.

### FR-4: Order Creation

- The system SHALL accept order creation via `POST /api/orders`.
- Creation SHALL require `orderNumber`, `orderDate`, `currency`, `subtotal`, and `totalAmount`; every other field SHALL be optional.
- Creation SHALL assign the identifier, timestamps, and defaults, and SHALL return the complete order including those generated values.
- Creation SHALL be rejected when the supplied `orderNumber` is already in use (LIM-1).

### FR-5: Order Retrieval, Update, and Deletion

- The system SHALL expose `GET /api/orders/:id`, returning the complete order.
- The system SHALL accept partial updates via `PATCH /api/orders/:id`; a field absent from the request SHALL retain its current value, and the update SHALL refresh `updatedAt` and return the complete order.
- The system SHALL accept `DELETE /api/orders/:id` as a permanent removal, returning a success acknowledgement carrying the deleted order's identifier.

### FR-6: Order Listing

- The system SHALL expose `GET /api/orders`, filterable by `status` (exact match), ordered by order date with the newest first.

### FR-7: Customer Order History Endpoint

- The system SHALL expose `GET /api/orders/me`, returning the authenticated customer's orders together with their line items.
- The endpoint SHALL derive the customer from the request's session and SHALL NOT accept a customer identifier from the caller (LIM-7; Security).
- The endpoint SHALL exclude orders in `cart` status (LIM-8) and orders not associated with a customer (FR-1).
- Results SHALL be ordered by order date, newest first.
- A customer with no orders SHALL receive an empty result rather than an error.
- An unauthenticated request SHALL be rejected (`auth.md` FR-4).

### FR-8: Order History Surface

- The order history surface SHALL be addressed at `/orders` and SHALL require authentication; an unauthenticated visitor SHALL be sent to sign in and returned to `/orders` afterwards (`auth.md` FR-9).
- The surface SHALL list the customer's orders newest first, each showing its order number, order date, total amount with currency, and status.
- Each status SHALL be rendered distinctly — by color, badge, or icon — so a customer can tell one status from another at a glance.
- An order carrying a status outside the known vocabulary SHALL be displayed with its raw status value rather than hidden.
- The surface SHALL display a loading indicator while orders are being retrieved, without blocking the page header or navigation.
- When retrieval fails, the surface SHALL display an error message and offer a control that retries the request.
- When the customer's session expires while they are on the surface, they SHALL be sent to sign in and returned to `/orders` afterwards.

### FR-9: Order Detail View

- Each listed order SHALL be expandable and collapsible in place, without navigating away.
- At most one order SHALL be expanded at a time; expanding an order SHALL collapse any other (LIM-6).
- An expanded order SHALL display its line items — product name, product image, quantity, unit price, and line total — its pricing breakdown of subtotal, tax, shipping, discount where applicable, and total, its delivery address where available, its payment method or transaction reference where available, and its timeline of order date, expected delivery date, and paid date where available.
- A line item with no image reference SHALL display a placeholder image in its place.
- Amounts and dates SHALL be formatted according to the order's currency and the application's locale.
- An order carrying no line items SHALL display a message saying so rather than an empty region.
- The detail view SHALL be read-only; it SHALL offer no control that edits, cancels, or reorders.

### FR-10: Empty State

- When the customer has no orders, the surface SHALL display an empty state saying no order has been placed yet, carrying a call to action that routes to the product catalog.

## Technical Requirements (System Limits)

- **LIM-1 — Unique order number.** No two orders share an `orderNumber`; a create or update that would collide is rejected as a conflict. (FR-4, FR-5)
- **LIM-2 — Closed status vocabulary.** An order's `status` is one of `cart`, `draft`, `confirmed`, `processing`, `shipped`, `fulfilled`, `paid`, `cancelled`; any other value is rejected at the write boundary. (FR-2)
- **LIM-3 — Monetary precision.** `subtotal`, `taxAmount`, `discountAmount`, `shippingAmount`, `totalAmount`, and every line item's unit price and line total carry exactly two decimal places. (FR-1, FR-3)
- **LIM-4 — Required fields.** An order always has an `orderNumber`, `orderDate`, `currency`, `subtotal`, and `totalAmount`; none of them may be cleared by an update. (FR-1, FR-4)
- **LIM-5 — Pricing component defaults.** `taxAmount`, `discountAmount`, and `shippingAmount` default to zero and are never null. (FR-1)
- **LIM-6 — One expanded order.** The order history surface holds at most one expanded order at a time. (FR-9)
- **LIM-7 — Order history isolation.** `GET /api/orders/me` returns only orders owned by the caller's own session; no request parameter can widen it to another customer's orders. (FR-7; Security)
- **LIM-8 — Carts are not orders in history.** No order in `cart` status appears in any customer order-history response or surface. (FR-2, FR-7)

## Constraints (Externally Imposed)

- **CON-1 — ISO 4217 currency codes.** An order's `currency` is an ISO 4217 code; the vocabulary is defined by that standard, not by this feature. (FR-1)
- **CON-2 — Cart state ownership.** The `cart` status, the guest cart lifecycle, and every mutation of a cart's line items are owned by `cart.md`; this feature owns the record they act on. (FR-2, FR-3)
- **CON-3 — Checkout owns placement.** The transition from `cart` to `confirmed`, the permanent order number, and the addresses recorded at placement are assigned by `checkout.md`. (FR-2, FR-4)
- **CON-4 — Payment processing owns settlement.** `status = paid`, `paidAt`, and `paymentTransactionId` are written by the payment webhook path in `payment-webhooks.md`; this feature only exposes them. (FR-1, FR-2)
- **CON-5 — Session authentication.** The session that identifies the customer on the order-history path is owned by `auth.md`. (FR-7, FR-8)
- **CON-6 — Referential integrity with products.** A line item references a live product, so a product with order items cannot be hard-deleted; archiving a product leaves historical line items displayable. (FR-3)

## Error Scenarios

| Scenario | Response |
|---|---|
| Create or update an order with a missing required field or an invalid value | HTTP 400 — validation error |
| Create an order with an `orderNumber` already in use | HTTP 409 — conflict |
| Retrieve, update, or delete an order that does not exist | HTTP 404 — order not found |
| Request a `status` outside the closed vocabulary | HTTP 400 — validation error |
| `GET /api/orders/me` without a valid session | HTTP 401 |
| `GET /api/orders/me` for a customer with no orders | HTTP 200 — empty result |
| An order carries no line items | Returned with an empty item set; the surface says no items were found for that order |
| An order carries a status outside the known vocabulary | Returned as stored; the surface renders the raw status value |
| Order history retrieval fails on the surface | Error message with a retry control |
| Session expires while the customer is on the order history surface | Sent to sign in, returned to `/orders` afterwards |
| Unexpected failure on any order route | HTTP 500 — internal server error |

## Security Considerations

- The customer order-history path SHALL derive its owner from the request's session, never from a customer identifier the caller supplies, so no caller can read another customer's purchase history by changing a parameter (LIM-7).
- An order belonging to another customer SHALL be unreachable from every customer-facing surface (FR-7, FR-8).
- Order responses SHALL carry no payment detail beyond a payment method type or a provider transaction reference; card numbers and equivalent instrument data SHALL never appear (FR-1, FR-9).
- The management surface reaches every order regardless of owner and SHALL therefore be authenticated as a privileged surface (`internal-authentication.md`).

## Monitoring and Observability

- Each customer order-history request SHALL be logged with the resolved customer and the number of orders returned, so a customer reporting missing orders can be checked against what was actually served.

## References

### Related Specs

- `cart.md` — the `cart` status, line-item mutation, and the guest cart lifecycle
- `checkout.md` — placing an order: the `cart` → `confirmed` transition, order numbering, and addresses
- `payment-webhooks.md` — the `paid` transition, `paidAt`, and `paymentTransactionId`
- `products.md` — the product entity a line item snapshots
- `auth.md` — the session behind the customer order-history path
- `saved-addresses.md` — the address book from which an order's addresses may be resolved
