# Cart

## Overview

A cart holds the products a customer has selected before they buy. It is modeled as an order in `cart` status carrying line items, so that checkout converts the cart into the placed order rather than copying it. Both guests and authenticated customers keep a persistent, server-held cart: a guest cart is identified by a `cart_token` cookie the server issues, an authenticated customer's cart is identified by their session. When a guest signs in, their guest cart merges into their account's cart automatically.

Each line item snapshots the product's name, SKU, image, and unit price at the moment it is added, so the price a customer sees when they add an item is the price they carry to checkout regardless of later catalog edits. The customer reaches the cart through three surfaces: a dedicated cart page with full quantity control, a sidebar visible while browsing the catalog, and inline quantity controls on each product card.

This specification covers cart identity and ownership, the line-item contract, the guest token lifecycle and merge, cart totals, and the three customer surfaces. The order entity and its status vocabulary are owned by `orders.md`; the product entity is owned by `products.md`; session authentication and the login request that triggers the merge are owned by `auth.md`; converting a cart into a confirmed order is owned by `checkout.md`.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define cart identity for guests and authenticated customers, and the precedence between the two
- Define the line-item contract: what a line item snapshots, and what makes two additions the same line
- Define the guest cart token lifecycle — issue, refresh, expiry — and the automatic merge on sign-in
- Define cart totals and the price-locking guarantee
- Define the three customer surfaces and the optimistic-update contract they share
- Define the currency, quantity, and lifetime limits the cart enforces

### Non-Goals

- Converting a cart into a placed order (`checkout.md`)
- Inventory and stock enforcement — a customer may add any quantity of an active product
- Multi-currency carts — a single cart holds a single currency
- Coupons, discounts, and promotion logic
- Saved items, wishlists, and cart sharing between customers
- Quantity controls inside the cart sidebar — the sidebar is a read-only summary
- Cart controls on the search results surface

## Functional Requirements

### FR-1: Cart Identity and Ownership

- A cart SHALL be an order in `cart` status (`orders.md` FR-2) owned by exactly one of an authenticated customer or a guest cart token.
- The system SHALL create a cart implicitly when the first item is added; there SHALL be no separate cart-creation call.
- Cart operations SHALL NOT require authentication.
- When a request carries both a session and a `cart_token` cookie, the session SHALL take precedence and the request SHALL act on the authenticated customer's cart.
- Cart routes SHALL be reachable by unauthenticated callers by construction, not as a side effect of route ordering.

### FR-2: Guest Cart Token and Lifetime

- On creating a guest cart, the system SHALL issue a cart token and set it as the `cart_token` cookie on the response, so the browser returns it automatically on every later cart request (LIM-6, CON-4).
- The client SHALL NOT be required to read, store, or attach the cart token itself.
- A guest cart SHALL expire after a rolling lifetime measured from its last modification, and every modification SHALL refresh both the cart's expiry and the cookie's (LIM-4).
- An expired cart SHALL be treated as though it does not exist.
- A `cart_token` that matches no live cart SHALL be reported as not found rather than silently replaced with a new empty cart.

### FR-3: Adding an Item

- The system SHALL accept `POST /api/cart/items` carrying a product identifier and a quantity.
- The system SHALL reject an item whose product does not exist or is not `active` (`products.md` FR-2).
- The first item added SHALL set the cart's currency; a later item whose product currency differs SHALL be rejected (LIM-2).
- Adding SHALL snapshot the product's name, SKU, image reference, and current unit price onto the line item; the snapshot SHALL NOT change when the product is later edited (LIM-5).
- Adding a product already in the cart SHALL increase the existing line item's quantity rather than create a second line for the same product (LIM-3).
- The quantity SHALL be a positive integer (LIM-1).

### FR-4: Viewing the Cart

- The system SHALL expose `GET /api/cart`, returning the cart's line items and its totals.
- Each line item SHALL carry its identifier, the product identifier, the snapshotted product name, SKU, and image reference, the locked unit price, the quantity, and the line total.
- The cart SHALL carry a subtotal and a total item count (FR-6).
- When the caller has no cart, the system SHALL return an empty cart — zero items and zero totals — rather than an error, so a first-time visitor is not treated as a failure.

### FR-5: Changing and Removing Items

- The system SHALL accept `PATCH /api/cart/items/:itemId` to set a line item's quantity to a positive integer (LIM-1).
- Setting a quantity of zero SHALL be rejected; removal is a distinct operation.
- The system SHALL accept `DELETE /api/cart/items/:itemId` to remove a single line item, and `DELETE /api/cart` to empty the cart entirely.
- Removing the last line item SHALL discard the cart itself.

### FR-6: Totals

- A line total SHALL be the line item's locked unit price multiplied by its quantity.
- The cart subtotal SHALL be the sum of its line totals, and the item count the sum of its quantities.
- Totals SHALL be recomputed and persisted on the underlying order whenever line items change, so the cart's totals and the order's totals never disagree (LIM-7).

### FR-7: Guest-to-Customer Merge

- Merging SHALL be triggered by the system on sign-in when the login request carries a `cart_token` cookie (`auth.md` FR-2); the client SHALL NOT be required to call for it.
- When the customer has no cart, the guest cart SHALL be reassigned to them: it becomes their cart, loses its cart token, and loses its guest expiry.
- When the customer already has a cart, line items SHALL be merged into it: a product present in both carts has its quantities summed, and a product present only in the guest cart is added.
- After a merge the guest cart SHALL be discarded and the `cart_token` cookie SHALL be cleared on the response.
- A merge SHALL be atomic: either the whole merge is applied or none of it is, so no cart is left half-transferred.
- The system SHALL additionally expose `POST /api/cart/merge`, requiring authentication, for the case where a guest cart token surfaces after sign-in has already completed.

### FR-8: Cart Page

- The cart page SHALL list every line item with its product image, name, SKU, unit price, quantity, and line total.
- The page SHALL offer increment and decrement controls for each item's quantity and a control to remove the item.
- The page SHALL display a summary carrying the subtotal and the total item count.
- When the cart is empty, the page SHALL display an empty state with a route back to the catalog.
- The page SHALL offer a control to proceed to checkout (`checkout.md` FR-8).
- The page SHALL NOT read, write, or clear the cart token; the cookie is managed entirely by the server (FR-2).

### FR-9: Cart Sidebar on Catalog Surfaces

- The catalog and product detail surfaces (`products.md` FR-7, FR-8) SHALL display a cart summary alongside the product content, so a customer can see their cart without leaving the catalog.
- The sidebar SHALL list each line item's product name, quantity, and line total, and SHALL display the cart subtotal.
- The sidebar SHALL remain visible as the customer scrolls the product content.
- The sidebar's item list SHALL scroll within its own bounds when it holds many items, so the subtotal and the actions below it remain visible.
- The sidebar SHALL offer routes to the cart page and to checkout.
- When the cart is empty, the sidebar SHALL display an empty state and SHALL NOT display a subtotal or a checkout route.
- The sidebar SHALL be hidden on small viewports, where the full width belongs to the product content.
- The sidebar SHALL reflect a cart change made from any other surface without requiring a page reload.
- A failure to load the cart SHALL leave the sidebar silent rather than raise an error; the sidebar is supplementary and never blocks browsing.

### FR-10: Inline Cart Controls on Product Cards

- Each product card in the catalog grid SHALL carry cart controls whose state reflects whether that product is currently in the cart.
- For a product not in the cart, the card SHALL present a pending-quantity picker defaulting to 1 and an add control; a successful add SHALL move the card to the in-cart state and reset the pending quantity to 1.
- For a product in the cart, the card SHALL present increment and decrement controls beside the quantity currently held in the cart, not a locally tracked count, so the card stays correct when the cart is changed from another surface.
- Decrementing a quantity of 1 SHALL remove the item and return the card to the not-in-cart state; the decrement control SHALL NOT be disabled at 1.
- While a mutation for that card is in flight, that card's controls SHALL be disabled and no other card's controls SHALL be affected.
- Cart controls SHALL be activatable without triggering the card's navigation to the product detail surface.
- Cart controls SHALL remain present on small viewports, where the sidebar is hidden (FR-9).
- While the cart is still loading, a card SHALL display a loading indicator in place of its controls; if the cart cannot be loaded, a card SHALL fall back to the not-in-cart state so the customer can still add.
- Each control SHALL carry an accessible label naming the product it acts on, and the displayed quantity SHALL be announced to assistive technology when it changes.

### FR-11: Optimistic Updates

- A quantity change or removal made from any surface SHALL be reflected immediately, before the server confirms it.
- A failed mutation SHALL restore the pre-mutation state and surface an error, leaving no optimistic value visible.
- A failed add SHALL preserve the customer's pending quantity so they can retry without re-entering it.
- An error SHALL be scoped to the surface or card that produced it and SHALL NOT disturb the rest of the page.
- Server-returned values SHALL replace optimistic values once a mutation settles; no client-computed total SHALL be persisted.

## Technical Requirements (System Limits)

- **LIM-1 — Positive integer quantity.** A line item's quantity is an integer of at least 1; zero, negative, and fractional quantities are rejected. (FR-3, FR-5)
- **LIM-2 — Single currency per cart.** A cart holds exactly one currency, fixed by its first item; a product in another currency cannot be added. (FR-3)
- **LIM-3 — One line per product.** A cart holds at most one line item per product; adding the same product again changes the existing line's quantity. (FR-3)
- **LIM-4 — Guest cart lifetime.** A guest cart and its `cart_token` cookie both expire 30 days after the cart was last modified, and every modification restarts that 30 days. A cart past its expiry is not found. (FR-2)
- **LIM-5 — Price locked at add time.** A line item's unit price, product name, SKU, and image reference are captured when the item is added and never change afterwards, including when the product is edited, repriced, or archived. (FR-3)
- **LIM-6 — Cart token randomness.** A cart token is a cryptographically random UUID carrying 122 bits of entropy; carts cannot be found by enumerating or guessing tokens. (FR-2; Security)
- **LIM-7 — Monetary precision.** Line totals and cart totals carry exactly two decimal places and are computed in fixed-point arithmetic, never floating point. (FR-6)
- **LIM-8 — Active products only.** Only an `active` product can be added to a cart. (FR-3)

## Constraints (Externally Imposed)

- **CON-1 — Cart is an order.** A cart is an order in `cart` status; the order entity, its status vocabulary, and its total columns are owned by `orders.md`. Adding `cart` to that vocabulary is a change to the order contract, not a cart-local one. (FR-1, FR-6)
- **CON-2 — Product entity.** Product identity, status, currency, and price are owned by `products.md`; the cart snapshots them and does not define them. (FR-3, LIM-5)
- **CON-3 — Session authentication.** The session that identifies an authenticated customer's cart, and the login request that triggers the merge, are owned by `auth.md`. (FR-1, FR-7)
- **CON-4 — Browser cookie semantics.** The `cart_token` cookie is scoped to path `/`, sent with `SameSite=Lax`, marked `Secure` outside development, and carries a `Max-Age` matching the cart lifetime. It is deliberately readable by client script: the token identifies one anonymous cart and is not a credential, so withholding it from script would buy no protection. (FR-2; Security)
- **CON-5 — Referential integrity with products.** A line item references a live product, so a product with cart items cannot be hard-deleted; withdrawing a product is done by archiving it, which leaves existing cart items displayable. (FR-3, LIM-5)

## Error Scenarios

| Scenario | Response |
|---|---|
| Add an item whose product does not exist | HTTP 404 — "Product not found" |
| Add an item whose product is not `active` | HTTP 422 — "Product is not available" |
| Add an item whose currency differs from the cart's | HTTP 422 — "Product currency does not match cart currency" |
| Quantity of zero, negative, or non-integer | HTTP 400 — validation error |
| Change or remove a line item that is not in the cart | HTTP 404 — "Cart item not found" |
| Request carries a `cart_token` matching no live or unexpired cart | HTTP 404 — "Cart not found" |
| `GET /api/cart` with no cart of any kind | HTTP 200 — empty cart, zero items, zero totals |
| `POST /api/cart/merge` without authentication | HTTP 401 — "Authentication required" |
| `POST /api/cart/merge` with a guest token matching no cart | HTTP 404 — "Guest cart not found" |
| A mutation fails after an optimistic update was applied | Prior state restored on the affected surface; error surfaced; other surfaces unaffected |
| Cart cannot be loaded on a catalog surface | Sidebar renders nothing; product cards fall back to the not-in-cart state |
| Repeated activation of a control while its mutation is in flight | Ignored — that card's controls are disabled until the mutation settles |

## Security Considerations

- A cart token SHALL be cryptographically random, so one guest's cart cannot be reached by guessing or enumerating tokens (LIM-6).
- Cart responses SHALL disclose nothing about any cart other than the one the caller's session or token resolves to (FR-1).
- The `cart_token` cookie is deliberately not withheld from client script, because the token grants access to one anonymous cart and never to an account; treating it as a credential would imply a protection it does not provide (CON-4).
- `POST /api/cart/merge` SHALL require authentication, so a guest token cannot be used to graft a cart onto an account that did not present it (FR-7).
- Cart identity SHALL always be derived from the caller's session or cookie and never from a customer identifier supplied in the request (FR-1).
- Product identifiers and quantities SHALL be validated at the API boundary before reaching storage (FR-3, FR-5).
- Client-side disabling of controls during a mutation is a usability measure only; the server SHALL remain the authority on concurrent cart changes (FR-11).

## Monitoring and Observability

- Each merge SHALL be logged with the resolved customer and the guest cart it consumed, so a disputed or lost cart after sign-in can be reconstructed.
- Cart creation and item-addition rates SHALL be observable, so an abnormal spike — a sign of automated abuse — is detectable against a normal baseline.

## References

### Related Specs

- `orders.md` — the order entity, the `cart` status, and the totals a cart writes
- `products.md` — the product entity and the fields a line item snapshots
- `checkout.md` — converting the cart into a confirmed order
- `auth.md` — the session that owns an authenticated cart, and the sign-in that triggers the merge
