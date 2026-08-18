# Saved Addresses

## Overview

Saved addresses give an authenticated customer a persistent address book, so shipping and billing details are entered once and reused on every later order. A customer manages the book directly — creating, editing, deleting, and designating one address as their default — and reaches it again at checkout, where the default is pre-selected, any saved address can be chosen instead, and a one-off address can still be typed inline.

The address book is a single shared pool: an address is not designated as a shipping address or a billing address, and either role may draw from it. Addresses stored on placed orders are independent copies; changing or deleting a saved address never alters what a historical order recorded.

This specification covers the address entity, the management surface, the default-address rule, and the checkout extensions that resolve a saved address or save an inline one. The checkout flow itself, the address field contract, and the placement of resolved addresses onto an order are owned by `checkout.md`; the order record is owned by `orders.md`; authentication is owned by `auth.md`.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define the saved-address entity and the per-customer address book
- Define the management surface: list, create, update, delete
- Define the default-address rule, including how a default is established, moved, and lost
- Define the checkout extensions: resolving a saved address by identifier, and saving an inline address during checkout
- Define the per-customer address limit and the ownership isolation that governs every operation

### Non-Goals

- Guest address storage — an unauthenticated customer always types an address fresh
- Separate shipping and billing address pools — the book is one shared pool
- Validating an address against postal-authority data
- Address auto-complete and suggestions
- Automatic default reassignment when the default address is deleted
- The checkout flow and the address field contract (`checkout.md`)

## Functional Requirements

### FR-1: Address Book

- The system SHALL maintain an address book per authenticated customer, reachable at any time and not only during checkout.
- Every address operation SHALL derive its owner from the request's session and SHALL never accept a customer identifier from the caller (Security).
- A saved address SHALL carry the same fields as a checkout address (`checkout.md` FR-2): a full name, a first address line, a city, a postal code, and an ISO 3166-1 alpha-2 country code, and optionally a second address line, a state or region, and a phone number.
- A saved address SHALL carry a default flag and `createdAt` and `updatedAt` timestamps.

### FR-2: Listing Addresses

- The system SHALL expose `GET /api/v1/addresses`, returning every address the authenticated customer has saved.
- Results SHALL be ordered with the default address first, then by creation time, oldest first, so the address a customer most likely wants leads the list.
- A customer with no saved addresses SHALL receive an empty result rather than an error.

### FR-3: Creating an Address

- The system SHALL expose `POST /api/v1/addresses`, accepting the address fields and an optional request to make the new address the default.
- A customer's first saved address SHALL become their default automatically.
- Creation SHALL be rejected when the customer already holds the maximum number of addresses (LIM-1).

### FR-4: Updating an Address

- The system SHALL expose `PUT /api/v1/addresses/:id`, updating any field of an address the caller owns.
- Setting the default flag on an address SHALL make it the customer's default (FR-6).

### FR-5: Deleting an Address

- The system SHALL expose `DELETE /api/v1/addresses/:id`, removing an address the caller owns.
- Deleting an address SHALL NOT alter the address recorded on any existing order (LIM-4).
- Deleting the default address SHALL leave the customer with no default; the system SHALL NOT promote another address in its place (LIM-3).

### FR-6: Default Address

- A customer SHALL have at most one default address at any moment (LIM-2).
- Designating a new default SHALL clear the previous default in the same atomic operation, so no moment exists in which the customer has two defaults or none unexpectedly.

### FR-7: Checkout Address Selection

- At checkout, an authenticated customer holding saved addresses SHALL be presented with a picker listing them, and SHALL be able to choose to enter a new address inline instead.
- When the customer has a default address, the picker SHALL pre-select it for the shipping address.
- A checkout request SHALL accept, for each of shipping and billing, either a saved-address identifier or an inline address — exactly one of the two (LIM-5).
- A supplied saved-address identifier SHALL be resolved against the authenticated customer's own book; an identifier the customer does not own SHALL be rejected (Security).
- A resolved saved address SHALL be used from that point exactly as an inline address would be, and SHALL be stored on the order as an independent copy (`checkout.md` FR-2, LIM-4).
- The "billing same as shipping" flag SHALL continue to apply regardless of how the shipping address was supplied, taking the resolved shipping address as the billing address (`checkout.md` FR-2).

### FR-8: Saving an Address During Checkout

- A checkout request MAY ask that an inline address be saved to the customer's address book.
- A save request SHALL be valid only alongside an inline address, never alongside a saved-address identifier (LIM-5).
- An address saved during checkout SHALL become the customer's default when they have no default at that moment (FR-3).
- Saving SHALL be part of the checkout operation, so an address is never saved for a checkout that did not complete (`checkout.md` FR-4).

## Technical Requirements (System Limits)

- **LIM-1 — Address book size.** A customer holds at most 20 saved addresses; a creation that would exceed it is rejected. (FR-3)
- **LIM-2 — At most one default.** A customer has at most one default address at any moment, enforced by the address store itself and not by application sequencing alone, so two concurrent requests cannot both leave a default set. (FR-6)
- **LIM-3 — No automatic default reassignment.** Deleting the default address leaves the customer with no default until they designate one. (FR-5)
- **LIM-4 — Order addresses are independent.** An address recorded on an order is a copy; editing or deleting the saved address it came from never changes what the order recorded. (FR-5, FR-7)
- **LIM-5 — Exactly one address source per role.** For each of shipping and billing, a checkout request supplies either an inline address or a saved-address identifier — never both and never neither — and a save-this-address request is valid only with the inline form. Billing may alternatively be satisfied by the "billing same as shipping" flag. (FR-7, FR-8)
- **LIM-6 — Ownership isolation.** Every read, update, delete, and checkout resolution is confined to the caller's own addresses; an address belonging to another customer is reported as not found. (FR-1; Security)

## Constraints (Externally Imposed)

- **CON-1 — ISO 3166-1 alpha-2 country codes.** A saved address's country code is an ISO 3166-1 alpha-2 code, the same vocabulary checkout enforces. (FR-1)
- **CON-2 — Checkout owns the address contract.** The address field set, its validation, and the placement of a resolved address onto an order are owned by `checkout.md`; this feature owns storage, selection, and the default rule. (FR-1, FR-7)
- **CON-3 — Session authentication.** The session identifying the address book's owner is owned by `auth.md`. (FR-1)
- **CON-4 — Customer lifecycle.** An address book belongs to a customer account and does not outlive it; deleting the customer removes their saved addresses. (FR-1)
- **CON-5 — Additive checkout extension.** The saved-address fields extend the checkout request additively; a request supplying only inline addresses remains valid, so existing callers are unaffected. (FR-7, FR-8)

## Error Scenarios

| Scenario | Response |
|---|---|
| Any address request without a valid session | HTTP 401 — authentication required |
| Read, update, or delete an address the caller does not own, or one that does not exist | HTTP 404 — "Address not found" |
| Create an address when the customer already holds 20 | HTTP 422 — "Address limit reached" |
| Create or update with a missing required field or an invalid country code | HTTP 422 — field-level validation errors |
| Checkout supplying both an inline shipping address and a shipping address identifier | HTTP 422 — "Provide either shippingAddress or shippingAddressId, not both" |
| Checkout supplying neither an inline shipping address nor an identifier | HTTP 422 — "Shipping address is required" |
| Checkout supplying a shipping address identifier the customer does not own | HTTP 422 — "Shipping address not found" |
| Checkout asking to save an address that was supplied by identifier | HTTP 422 — "Cannot save an already-saved address" |
| A saved address is deleted between loading the checkout surface and submitting it | HTTP 422 — the identifier resolves to nothing and the customer is told so |
| Two requests concurrently designate different defaults | One prevails; the customer is left with exactly one default |

## Security Considerations

- The owning customer SHALL always be derived from the request's session and never from the request body, so no caller can write an address into another customer's book (FR-1).
- Every read, update, delete, and checkout resolution SHALL be confined to the caller's own addresses, and an address belonging to another customer SHALL be reported as not found rather than as forbidden, so the response does not confirm that the identifier exists (LIM-6).
- A saved-address identifier supplied at checkout SHALL be validated against the caller before the address data is read or stored on an order (FR-7).
- Address data is personally identifying; it SHALL be returned only to the customer who owns it (FR-2, LIM-6).

## Monitoring and Observability

- Address creation, update, deletion, and default changes SHALL each be logged with the address and the customer, so an address a customer reports as missing or altered can be traced.
- Address resolution during checkout SHALL be observable through the checkout path's own logging (`checkout.md`).

## References

### Related Specs

- `checkout.md` — the checkout flow, the address field contract, and where a resolved address is stored
- `orders.md` — the order record holding the independent address copies
- `auth.md` — the session that owns an address book
