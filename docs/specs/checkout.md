# Checkout

## Overview

Checkout converts a customer's cart into a placed order. An authenticated customer with items in their cart supplies a shipping address and a billing address and places the order; the system validates that everything in the cart is still purchasable, assigns a permanent order number, records the addresses, and advances the record from `cart` to `confirmed`. Because a cart is already an order (`orders.md` FR-2), checkout advances one record rather than copying a cart into a new one, so nothing is duplicated and nothing can drift between the two.

Placement is deliberately separate from payment: a confirmed order is a commitment to buy, not a settled one. Payment capture and the transition to `paid` are owned by `payment-webhooks.md`.

This specification covers checkout eligibility, address collection, order placement and its atomicity and idempotency guarantees, and the checkout and order-confirmation surfaces. The cart and its line items are owned by `cart.md`; the order entity, its statuses, and its line items are owned by `orders.md`; resolving a saved address in place of an inline one is owned by `saved-addresses.md`; authentication is owned by `auth.md`.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define what makes a cart eligible for checkout and what blocks it
- Define the address contract required to place an order
- Define order placement: the status transition, the permanent order number, and the cart identifiers it retires
- Define the atomicity and idempotency guarantees that make a retried or double-submitted checkout safe
- Define the checkout and order-confirmation surfaces and the entry point on the cart page

### Non-Goals

- Payment processing and payment forms (`payment-webhooks.md`)
- Guest checkout — an unauthenticated customer must sign in first
- Tax, shipping-cost, and discount calculation — each remains zero at placement
- The saved-address book and address-identifier resolution (`saved-addresses.md`)
- Inventory validation, stock reservation, and shipping-method selection
- Editing or cancelling an order after placement
- Order-confirmation email and other notifications

## Functional Requirements

### FR-1: Checkout Eligibility

- Checkout SHALL require authentication (`auth.md` FR-4).
- The system SHALL reject checkout when the customer has no cart, and when their cart holds no items.
- The system SHALL verify, at the moment of placement, that every product referenced by a cart line item is still `active` (`products.md` FR-2).
- When any referenced product is no longer active, the system SHALL reject the checkout and name the affected items, so the customer can see exactly what to remove.
- The system SHALL verify that the cart being checked out belongs to the authenticated customer (Security).

### FR-2: Address Collection

- A checkout request SHALL carry a shipping address and a billing address.
- An address SHALL carry a full name, a first address line, a city, a postal code, and an ISO 3166-1 alpha-2 country code (LIM-3, CON-1).
- An address MAY carry a second address line, a state or region, and a phone number.
- A checkout request MAY set a "billing same as shipping" flag; when set, the billing address SHALL be taken from the resolved shipping address.
- The system SHALL store the resolved shipping and billing addresses on the placed order, so the order records the addresses as they were at placement (`orders.md` FR-1).
- A checkout request MAY reference a saved address instead of supplying one inline; that resolution is owned by `saved-addresses.md` (CON-5).

### FR-3: Order Placement

- Placement SHALL advance the order's status from `cart` to `confirmed`.
- Placement SHALL replace the cart's provisional order number with a permanent one in a dated, daily-sequential format (LIM-1).
- Placement SHALL set the order date to the date of placement.
- Placement SHALL clear the cart token from the order and SHALL clear the `cart_token` cookie on the response, since the record is no longer a cart (`cart.md` FR-2).
- Placement SHALL return the confirmed order, carrying its new order number, status, addresses, line items, and totals.
- After a successful placement the customer's cart SHALL read as empty on every cart surface, including the header item count (`cart.md` FR-4, FR-9).

### FR-4: Atomicity

- Product validation, order-number assignment, the status transition, and address storage SHALL apply as a single atomic operation.
- When any step fails, none of the changes SHALL persist, and the cart SHALL remain exactly as it was before the attempt.

### FR-5: Idempotency

- A checkout submitted for an order that is already `confirmed` SHALL return that existing order rather than an error, so a double-submission or a network retry does not produce a second order or a spurious failure.
- Checkout SHALL be refused for an order in any status other than `cart` or `confirmed` (LIM-5).

### FR-6: Checkout Surface

- The checkout surface SHALL be addressed at `/checkout`.
- The surface SHALL display an order summary: each line item's product name, quantity, unit price, and line total, and the cart subtotal.
- The surface SHALL present a shipping address form and a billing address form, and a control that copies the shipping address into the billing address; while that control is set, the billing fields SHALL be filled from the shipping address and SHALL NOT be separately editable.
- The surface SHALL validate the required address fields before submitting, and SHALL report validation failures against the specific fields that failed.
- The surface SHALL offer a control that places the order, disabled while a placement is in flight so the customer cannot submit twice.
- On success, the surface SHALL route to the order confirmation surface for the placed order.
- When the customer has no cart or an empty one, the surface SHALL route back to the cart page rather than present a form that cannot be submitted.

### FR-7: Order Confirmation Surface

- The order confirmation surface SHALL be addressed by order number at `/orders/:orderNumber/confirmation`.
- The surface SHALL display the order number, order date, status, shipping address, billing address, line items with quantities and prices, and the order total.
- The surface SHALL offer a route back to the product catalog.
- When the order number matches no order the customer may see, the surface SHALL display an error state (Security).

### FR-8: Cart Page Entry Point

- The cart page's proceed-to-checkout control SHALL route to `/checkout` (`cart.md` FR-8).
- The control SHALL be offered only to an authenticated customer; an unauthenticated customer SHALL instead be prompted to sign in.

## Technical Requirements (System Limits)

- **LIM-1 — Order number format.** A placed order's number has the form `ORD-YYYYMMDD-XXXXX`, where `YYYYMMDD` is the placement date and `XXXXX` is a zero-padded sequence that restarts at 1 each day. (FR-3)
- **LIM-2 — Order-number contention.** A placement whose generated order number collides with an existing one retries with the next sequence number up to 3 times before failing; uniqueness is enforced by the order record itself (`orders.md` LIM-1), never by the generator alone. (FR-3)
- **LIM-3 — Required address fields.** An address always carries a full name, first address line, city, postal code, and country code; a request missing any of them is rejected. (FR-2)
- **LIM-4 — Zero-valued pricing components.** Tax, shipping, and discount are each zero on a placed order; checkout computes none of them. (FR-3)
- **LIM-5 — Checkout-eligible statuses.** Only an order in `cart` or `confirmed` status can be checked out; every other status is refused. (FR-5)
- **LIM-6 — Prices are not recomputed.** Placement carries each line item's locked unit price forward unchanged; a catalog price change between adding an item and placing the order does not alter what the customer pays (`cart.md` LIM-5). (FR-3)

## Constraints (Externally Imposed)

- **CON-1 — ISO 3166-1 alpha-2 country codes.** An address's country code is an ISO 3166-1 alpha-2 code; the vocabulary is defined by that standard, not by this feature. (FR-2)
- **CON-2 — Cart ownership.** The cart, its line items, its locked prices, and its token are owned by `cart.md`; checkout consumes them and retires the cart identity. (FR-1, FR-3)
- **CON-3 — Order entity ownership.** The order record, its status vocabulary, its uniqueness guarantee on the order number, and its address fields are owned by `orders.md`. (FR-3)
- **CON-4 — Session authentication.** The session identifying the customer, and the cart it resolves to, are owned by `auth.md`. (FR-1)
- **CON-5 — Saved addresses.** Referencing a stored address by identifier instead of supplying one inline, and saving an address during checkout, are owned by `saved-addresses.md`; this feature owns the address shape and the resolved address's placement on the order. (FR-2)
- **CON-6 — Payment is downstream.** A confirmed order is unpaid; settlement and the `paid` status arrive later through `payment-webhooks.md`, so nothing here may be read as evidence of payment. (FR-3; Security)

## Error Scenarios

| Scenario | Response |
|---|---|
| Checkout without authentication | HTTP 401 — "Authentication required" |
| Customer has no cart | HTTP 404 — "No active cart found" |
| Cart holds no items | HTTP 422 — "Cart is empty" |
| A referenced product is no longer active | HTTP 422 — the affected items are named in the response |
| Address missing a required field | HTTP 400 — validation error identifying the fields |
| Country code outside ISO 3166-1 alpha-2 | HTTP 400 — "Invalid country code" |
| Order-number contention exhausts its retries | HTTP 500 — "Unable to generate order number, please try again" |
| Checkout submitted for an already-confirmed order | HTTP 200 — the existing confirmed order is returned |
| Checkout submitted for an order in any other status | HTTP 422 — "Order cannot be checked out" |
| Any step of placement fails | Nothing persists; the cart is unchanged and still eligible for checkout |
| Confirmation surface opened for an order the customer may not see | Error state; no order data rendered |
| Checkout surface opened with no cart or an empty one | Routed back to the cart page |

## Security Considerations

- Checkout SHALL require authentication and SHALL verify that the cart it places belongs to the authenticated customer, so no customer can place another's cart (FR-1).
- The order confirmation surface SHALL display an order only to the customer who owns it, so an order number cannot be used to read another customer's addresses and purchases (FR-7).
- Address input SHALL be validated at the API boundary before it is stored or rendered (FR-2, LIM-3).
- A confirmed order SHALL NOT be treated anywhere as a paid one; fulfillment decisions belong downstream of settlement (CON-6).

## Monitoring and Observability

- Each successful placement SHALL be logged with the customer, the assigned order number, and the item count, so a placed order can be traced to the request that placed it.
- Each rejected checkout SHALL be logged with its reason — empty cart, inactive product, or address validation — so a rise in one cause is distinguishable from a rise in another.

## References

### Related Specs

- `cart.md` — the cart, its line items and locked prices, and the token checkout retires
- `orders.md` — the order record, its statuses, its line items, and order-number uniqueness
- `saved-addresses.md` — resolving a stored address at checkout and saving an address during it
- `payment-webhooks.md` — settlement and the `paid` transition that follows placement
- `products.md` — the product status checkout re-verifies at placement
- `auth.md` — the session required to check out
