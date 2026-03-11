# Saved Addresses

## Overview

Users currently must re-enter shipping and billing addresses on every checkout. This feature adds a persistent address book so authenticated users can save, manage, and reuse addresses across orders — the standard e-commerce pattern found in Amazon, Shopify storefronts, etc.

## Goals

- Allow authenticated users to save, list, edit, and delete addresses
- Enable users to designate one address as default (auto-selected at checkout)
- Allow saving a new address during the checkout flow
- Show a saved-address picker at checkout; users may also enter a one-off address
- Reduce checkout friction for repeat customers

## Non-Goals

- Guest address storage (guests always type addresses fresh)
- Separate shipping vs. billing address pools (one shared address book)
- Address validation against postal authority data
- Address auto-complete / suggestions (separate feature)

## Functional Requirements

**FR-1**: The system SHALL provide an address book for each authenticated user, accessible at any time outside of checkout.

**FR-2**: A user SHALL be able to create a new saved address with: full name, address line 1, address line 2 (optional), city, state (optional), postal code, country code (ISO 3166-1 alpha-2), and phone (optional).

**FR-3**: A user SHALL be able to update any field of their saved addresses.

**FR-4**: A user SHALL be able to delete any of their saved addresses. Deletion SHALL NOT affect address data stored on historical orders.

**FR-5**: A user SHALL be able to mark exactly one saved address as their default. Setting a new default SHALL atomically unset the previous default.

**FR-6**: The system SHALL enforce a maximum of 20 saved addresses per user. Attempts to exceed this limit SHALL be rejected with an error.

**FR-7**: At checkout, authenticated users with saved addresses SHALL be presented with a picker listing their saved addresses; they MAY also select "Enter a new address" to type an address inline.

**FR-8**: If the user has a default address, it SHALL be pre-selected in the checkout shipping address picker.

**FR-9**: During checkout, the user MAY opt to save the entered address to their address book. If saved and the user has no existing default, the new address SHALL become the default.

**FR-10**: A checkout request SHALL accept either a saved address identifier or an inline address object for shipping and billing. Supplying both for the same field SHALL be rejected.

**FR-11**: The `billingSameAsShipping` flag SHALL continue to function when using saved address identifiers: when true, the resolved shipping address is used as billing regardless of whether it came from a saved address or inline input.

**FR-12**: Deleting the default address SHALL leave the user with no default. The system SHALL NOT auto-assign a new default.

**FR-13**: When a user creates their first address, it SHALL automatically become the default.

## Technical Requirements

**TR-1**: A new `addresses` table SHALL be added to the database with columns: `id` (UUID PK), `user_id` (UUID FK → users, CASCADE DELETE), `full_name`, `address_line_1`, `address_line_2` (nullable), `city`, `state` (nullable), `postal_code`, `country_code` (char 2), `phone` (nullable), `is_default` (boolean, default false), `created_at`, `updated_at` (both timestamptz).

**TR-2**: The `addresses` table SHALL have an index on `user_id` for efficient per-user lookups.

**TR-3**: The `addresses` table SHALL have a partial unique index on `(user_id) WHERE is_default = true` to enforce at most one default per user at the database level.

**TR-4**: A new `addresses` module SHALL be added to the backend following existing module conventions.

**TR-5**: Address API routes SHALL be exposed under `/api/v1/addresses` and included in the OpenAPI specification.

**TR-6**: The checkout request schema SHALL be extended with: `shippingAddressId` (UUID, optional), `billingAddressId` (UUID, optional), `saveShippingAddress` (boolean, optional), `saveBillingAddress` (boolean, optional). Existing inline `shippingAddress` / `billingAddress` fields SHALL remain valid.

**TR-7**: Setting a new default address SHALL update both the target and previous default in a single database transaction.

**TR-8**: When `saveShippingAddress` or `saveBillingAddress` is true during checkout, the address SHALL be persisted to the `addresses` table within the same checkout transaction.

## Data Model

### addresses

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() NOT NULL |
| user_id | uuid | FK → users(id) ON DELETE CASCADE, NOT NULL |
| full_name | text | NOT NULL |
| address_line_1 | text | NOT NULL |
| address_line_2 | text | nullable |
| city | text | NOT NULL |
| state | text | nullable |
| postal_code | text | NOT NULL |
| country_code | char(2) | NOT NULL |
| phone | text | nullable |
| is_default | boolean | NOT NULL DEFAULT false |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

Indexes:
- `addresses_user_id_idx` on `(user_id)`
- `addresses_one_default_per_user_idx` UNIQUE PARTIAL on `(user_id) WHERE is_default = true`

## API

### GET /api/v1/addresses
Returns all saved addresses for the authenticated user, ordered by `is_default DESC, created_at ASC`.

**Response 200**:
```json
{
  "addresses": [
    {
      "id": "uuid",
      "fullName": "John Doe",
      "addressLine1": "123 Main St",
      "addressLine2": null,
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "countryCode": "US",
      "phone": "+1-555-0100",
      "isDefault": true,
      "createdAt": "2026-03-11T10:00:00Z",
      "updatedAt": "2026-03-11T10:00:00Z"
    }
  ]
}
```

### POST /api/v1/addresses
Creates a new saved address.

**Request body**: address fields + optional `isDefault: boolean`

**Response 201**: the created address object

### PUT /api/v1/addresses/:id
Updates a saved address. Setting `isDefault: true` triggers an atomic default swap.

**Response 200**: the updated address object

### DELETE /api/v1/addresses/:id
Deletes a saved address.

**Response 204**: no body

### Checkout request extensions

`POST /api/checkout` additions (all optional, extend existing schema):

```json
{
  "shippingAddressId": "uuid",
  "billingAddressId": "uuid",
  "saveShippingAddress": true,
  "saveBillingAddress": false
}
```

Validation rules:
- Exactly one of `shippingAddress` (inline) or `shippingAddressId` SHALL be present (not both, not neither)
- For billing: exactly one of `billingAddress`, `billingAddressId`, or `billingSameAsShipping: true` SHALL be present
- `saveShippingAddress` / `saveBillingAddress` are only valid alongside inline address fields (not with `*AddressId`)

## Data Flows

### List addresses

1. **Client** → `GET /api/v1/addresses`
2. **Auth middleware** verifies session; rejects 401 if unauthenticated
3. **Addresses service** queries `addresses WHERE user_id = $userId ORDER BY is_default DESC, created_at ASC`
4. **Response** 200 with address list (empty array if none)

### Create address

1. **Client** → `POST /api/v1/addresses`
2. **Auth middleware** verifies session
3. **Addresses service** validates input; counts existing — rejects 422 if ≥ 20
4. If user has no addresses OR `isDefault: true` requested:
   - Transaction: `UPDATE addresses SET is_default = false WHERE user_id = $userId`; INSERT new address with `is_default = true`
5. Otherwise: INSERT with `is_default = false`
6. **Response** 201

### Set default (via PUT)

1. **Client** → `PUT /api/v1/addresses/:id` with `{ isDefault: true }`
2. **Auth middleware** verifies session
3. **Addresses service** confirms address belongs to user (404 if not)
4. Transaction:
   - `UPDATE addresses SET is_default = false WHERE user_id = $userId`
   - `UPDATE addresses SET is_default = true, updated_at = now() WHERE id = $id`
5. **Response** 200

### Delete address

1. **Client** → `DELETE /api/v1/addresses/:id`
2. **Auth middleware** verifies session
3. **Addresses service** confirms address belongs to user (404 if not)
4. `DELETE FROM addresses WHERE id = $id AND user_id = $userId`
5. **Response** 204

### Checkout with saved address ID

1. **Client** → `POST /api/checkout` with `shippingAddressId: "uuid"`
2. **Auth middleware** verifies session; rejects 401 if unauthenticated
3. **Checkout service** queries `addresses WHERE id = $shippingAddressId AND user_id = $userId` — 422 if not found
4. Resolved address object used as `shippingAddress` for the rest of the checkout flow (existing path)
5. Order stores the resolved address JSON
6. **Response** 200 with confirmed order

### Checkout with inline address + save flag

1. **Client** → `POST /api/checkout` with inline `shippingAddress` + `saveShippingAddress: true`
2. **Checkout service** validates inline address (existing validation)
3. Within checkout transaction:
   - If user has no default: INSERT address with `is_default = true`
   - Otherwise: INSERT address with `is_default = false`
4. Order stores the inline address JSON (same as today)
5. **Response** 200

## Security Considerations

- All `/api/v1/addresses` endpoints require an active authenticated session (401 if absent)
- Address ownership is enforced on every read, update, and delete — the service queries `WHERE id = ? AND user_id = ?` and returns 404 on mismatch to avoid information disclosure
- `user_id` is always derived from the authenticated session, never accepted from the request body
- Checkout `*AddressId` values are validated against the authenticated user before the address data is used

## Monitoring & Observability

- Structured log entries on address creation, update, delete, and default-change (include `addressId`, `userId`, operation name)
- Existing checkout service logs cover address resolution during checkout

## Error Scenarios

| Scenario | HTTP Status | Body |
|---|---|---|
| Unauthenticated request to any address endpoint | 401 | standard auth error |
| Address not found or not owned by requesting user | 404 | `{ error: "Address not found" }` |
| Address limit reached (user already has 20) | 422 | `{ error: "Address limit reached" }` |
| Invalid input (missing required fields, bad country code) | 422 | field-level validation errors |
| Checkout: both `shippingAddress` and `shippingAddressId` provided | 422 | `{ error: "Provide either shippingAddress or shippingAddressId, not both" }` |
| Checkout: neither `shippingAddress` nor `shippingAddressId` provided | 422 | `{ error: "Shipping address is required" }` |
| Checkout: `shippingAddressId` not owned by user | 422 | `{ error: "Shipping address not found" }` |
| Checkout: `saveShippingAddress: true` used with `shippingAddressId` | 422 | `{ error: "Cannot save an already-saved address" }` |

## Testing & Validation

### Unit / Integration Tests

- Address service: create (first address becomes default), create with explicit `isDefault`, list (ordered correctly), update fields, set-default (atomic swap), delete, delete default (no auto-reassign)
- Address service: reject creation when user already has 20 addresses
- Checkout service: resolve `shippingAddressId` (owned), reject `shippingAddressId` (not owned or not found), save-on-checkout for user with/without existing default, both inline and ID paths produce correct order address JSON
- Authorization: confirm 404 when operating on another user's address ID

### E2E Tests (Playwright)

**E2E-1 — Address book CRUD**: Authenticated user visits `/account/addresses`, adds a new address, verifies it appears as default, adds a second address, sets the second as default, deletes the first address.

**E2E-2 — Checkout pre-selects default**: Authenticated user with a saved default address opens checkout; default address is pre-selected in the shipping picker; user completes the order; confirmation page shows the correct address.

**E2E-3 — Save address at checkout**: Authenticated user with no saved addresses checks out with inline address and "Save this address" enabled; navigates to `/account/addresses` and sees the new address marked as default.

**E2E-4 — New inline address without saving**: Authenticated user with saved addresses selects "Enter a new address" at checkout and completes the order without saving; address book is unchanged afterwards.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Race condition when two requests set default simultaneously | Partial unique index (TR-3) provides DB-level enforcement; service also runs atomic transaction (TR-7) |
| Checkout schema extension breaks existing API clients | Inline `shippingAddress` / `billingAddress` remain valid; new fields are additive and all optional |
| User deletes address between checkout page load and submission | Checkout resolves and validates `*AddressId` at request time; validation returns 422 with clear error |
| Large address lists slow down checkout page load | Index on `user_id` (TR-2); 20-address cap (FR-6) keeps result sets small |
