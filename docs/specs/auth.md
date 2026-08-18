# Authentication

## Overview

Authentication establishes who a customer is and keeps them signed in across requests. A customer registers with a name, an email address, and a password; the password is hashed before storage and never leaves the system. A successful registration or sign-in creates a session and returns it as an httpOnly cookie, which the browser carries on every later request; protected routes resolve that cookie to a customer or reject the request. Signing out invalidates the session on the server and clears the cookie.

Authentication is the prerequisite for every customer-specific surface: checkout, order history, and the saved-address book all resolve their owner from the session. Signing in also consumes any guest cart the browser holds, so items collected before signing in follow the customer into their account.

This specification covers registration, sign-in, the session contract, request authentication, the current-customer endpoint, sign-out, and the sign-in and registration surfaces. Service-to-service authentication of the internal API is owned by `internal-authentication.md`; the guest cart merge triggered at sign-in is owned by `cart.md`.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define registration and sign-in, and the identical failure contract that keeps them from disclosing which accounts exist
- Define the session: how it is issued, carried, extended, and invalidated
- Define how a protected route resolves a session to a customer and what it does when it cannot
- Define the current-customer endpoint and what it may and may not disclose
- Define the sign-in and registration surfaces and the redirect contract for guarded routes

### Non-Goals

- Password reset and forgotten-password recovery
- Federated sign-in — OAuth, social, and enterprise identity providers
- Multi-factor authentication
- Administrative user management — creating, suspending, or deleting accounts through an API
- Extended-lifetime "remember me" sessions — every session carries the same configured lifetime
- Authorization beyond the existing administrator flag on a customer record
- Service-to-service authentication of internal APIs (`internal-authentication.md`)

## Functional Requirements

### FR-1: Registration

- The system SHALL accept registration via `POST /api/auth/sign-up/email`, carrying a name, email address, and password.
- The system SHALL enforce a minimum password length (LIM-1).
- The system SHALL hash the password before storing it; the plaintext password SHALL NOT be persisted, logged, or returned (LIM-4, CON-1).
- The system SHALL reject registration when the email address is already in use, disclosing that the address is already registered (Error Scenarios).
- A successful registration SHALL create a session and return it as a session cookie, so the customer is signed in immediately without a second step.
- A successful registration SHALL trigger a verification email to the registered address. Sign-in SHALL NOT be blocked on verifying it (Non-Goals still cover password reset and MFA; verification here is send-only).

### FR-2: Sign-in

- The system SHALL accept sign-in via `POST /api/auth/sign-in/email`, carrying an email address and password.
- The system SHALL respond identically — in both message and observable timing — whether the address is unknown or the password is wrong, so neither response reveals that an account exists (LIM-6; Security).
- A successful sign-in SHALL create a new session and return it as a session cookie.
- The session token SHALL NOT appear in the response body (LIM-5).
- When the sign-in request carries a `cart_token` cookie, the system SHALL attempt to merge the guest cart into the customer's cart as part of handling the same request, and SHALL clear the `cart_token` cookie once the merge succeeds (`cart.md` FR-7). A merge failure SHALL NOT abort the sign-in — the customer still ends the request signed in, with the guest cart left unmerged.

### FR-3: Session Cookie

- The session SHALL be carried in a cookie scoped to path `/`.
- The cookie SHALL be httpOnly, so client script cannot read the session token (Security).
- The cookie SHALL be marked `Secure` outside development, and SHALL be sent with `SameSite=Lax` (CON-2).
- A session SHALL carry a configurable lifetime (LIM-2), and the cookie's own expiry SHALL match it.
- A session's expiry SHALL slide: each authenticated request SHALL extend it by the full lifetime, so an actively used session does not expire mid-use.

### FR-4: Authenticated Requests

- A protected route SHALL require a session cookie that resolves to a live, unexpired session.
- On a valid session, the system SHALL resolve the customer — identifier, email, first name, last name, and administrator flag — and make them available to the route.
- The system SHALL reject a request whose session cookie is missing, unrecognized, or expired, with the same response regardless of which of those three is the case (Error Scenarios).
- The customer's identity SHALL be derived only from the session; the system SHALL NOT accept a customer identifier, email, or name supplied by the caller as identity (LIM-7; Security).

### FR-5: Current Customer

- The system SHALL expose a way to read the current session (`GET /api/auth/get-session`), returning the authenticated customer's identifier, email, first name, last name, administrator flag, and account creation date when signed in, and an empty result when not.
- No password hash or session token SHALL appear in this or any other response (LIM-4, LIM-5).

### FR-6: Sign-out

- The system SHALL expose `POST /api/auth/sign-out`, invalidating the session on the server and clearing the session cookie from the browser.
- Sign-out SHALL be idempotent: a request carrying no session, or an already-invalid one, SHALL succeed rather than fail, since there is nothing left to invalidate.

### FR-7: Sign-in Surface

- The sign-in surface SHALL be addressed at `/login` and SHALL present an email field, a password field, and a submit control.
- The surface SHALL link to the registration surface.
- A failed sign-in SHALL display one generic message covering every cause, with no field-level distinction between an unknown address and a wrong password (LIM-6).
- The submit control SHALL be disabled while a sign-in is in flight.
- On success, the surface SHALL route the customer to the page they were trying to reach, or to the product catalog when there was none.

### FR-8: Registration Surface

- The registration surface SHALL be addressed at `/register` and SHALL present first name, last name, email, password, and password-confirmation fields.
- The surface SHALL verify before submitting that the two password fields match and that the password meets the minimum length (LIM-1).
- The surface SHALL link to the sign-in surface.
- On failure, the surface SHALL display the message the system returned.
- On success, the surface SHALL route the customer to the product catalog.

### FR-9: Guarded Surfaces

- A surface requiring authentication SHALL send an unauthenticated visitor to `/login`, carrying the address they were trying to reach.
- After signing in, the customer SHALL be returned to that address.
- A session that expires while a customer is on a guarded surface SHALL send them to `/login` the same way, returning them afterwards.

## Technical Requirements (System Limits)

- **LIM-1 — Minimum password length.** A password is at least 8 characters; a shorter one is rejected at both the surface and the API. (FR-1, FR-8)
- **LIM-2 — Session lifetime.** A session lives for a configurable duration, 7 days by default, measured from its last authenticated use rather than from its creation. (FR-3)
- **LIM-3 — Session token randomness.** A session token is 32 cryptographically random bytes; sessions cannot be reached by guessing or enumerating tokens. (FR-3; Security)
- **LIM-4 — Passwords never leave.** A plaintext password is never persisted, never logged, and never returned; the stored hash and its salt appear in no response. (FR-1, FR-5)
- **LIM-5 — Session token stays in the cookie.** The session token appears only in the session cookie, never in a response body. (FR-2, FR-5)
- **LIM-6 — Indistinguishable authentication failures.** A registration against an existing address, a sign-in with an unknown address, and a sign-in with a wrong password are indistinguishable to the caller in message and in observable timing. (FR-1, FR-2, FR-7)
- **LIM-7 — Identity comes only from the session.** No request header or body field can establish, override, or widen the caller's identity. (FR-4; Security)
- **LIM-8 — Concurrent sessions.** A customer may hold several live sessions at once; signing in on one device does not invalidate another, and signing out invalidates only the session that made the request. (FR-2, FR-6)

## Constraints (Externally Imposed)

- **CON-1 — Password hashing function.** Passwords are hashed with scrypt at its library-default parameters, which carries its salt inside the encoded hash; the algorithm's cost and parallelism defaults are properties of that function and not of this feature. (FR-1)
- **CON-2 — Browser cookie semantics.** `SameSite=Lax` governs when the browser attaches the session cookie to cross-site requests, and is what makes it a CSRF mitigation for state-changing requests; `Secure` and httpOnly are likewise enforced by the browser, not by this feature. (FR-3; Security)
- **CON-3 — Guest cart merge.** The merge performed at sign-in, and the `cart_token` cookie it consumes, are owned by `cart.md`; this feature owns only the moment it happens relative to the sign-in request. (FR-2)
- **CON-4 — Customer record.** The customer entity, including the administrator flag, exists independently of authentication. (FR-4, FR-5)
- **CON-5 — Session storage growth.** Sessions accumulate as customers sign in and are not removed at expiry by the act of expiring; unbounded growth is a property of the store that must be addressed operationally. (FR-3)

## Error Scenarios

| Scenario | Response |
|---|---|
| Register with an email address already in use | HTTP 422 — "User already exists. Use another email." |
| Register with a malformed email address | HTTP 400 — validation error |
| Register with a password shorter than 8 characters | HTTP 400 — "Password too short" |
| Sign in with an unknown email address | HTTP 401 — "Invalid email or password" |
| Sign in with a wrong password | HTTP 401 — "Invalid email or password" (identical to the unknown-address response) |
| Request a protected route with no session cookie | HTTP 401 — "Authentication required" |
| Request a protected route with an unrecognized session token | HTTP 401 — "Authentication required" |
| Request a protected route with an expired session | HTTP 401 — "Authentication required" (identical to the unrecognized-token response) |
| Sign out with no active session | HTTP 200 — success, idempotent |
| Session expires while the customer is on a guarded surface | Sent to `/login` and returned to the same address after signing in |

## Security Considerations

- Passwords SHALL be hashed with argon2id and SHALL never be stored, logged, or returned in plaintext (FR-1, LIM-4, CON-1).
- Session tokens SHALL be cryptographically random, so a session cannot be reached by guessing (LIM-3).
- Registration and sign-in failures SHALL be indistinguishable in message and observable timing, so neither surface can be used to learn which email addresses hold accounts (LIM-6).
- The session cookie SHALL be httpOnly so client script cannot read the session token, and `Secure` outside development so it is not carried over plaintext connections (FR-3).
- `SameSite=Lax` SHALL be relied on as the CSRF mitigation for state-changing requests reached by cross-site navigation (CON-2).
- Caller identity SHALL be derived only from the session cookie; no header or body field SHALL establish or override it, so a caller cannot act as another customer by asserting one (LIM-7).
- Sign-in and registration are the system's brute-force surface, and each attempt costs deliberate hashing work; both SHALL be rate-limited per source, so repeated guessing is bounded and cannot be turned into a denial-of-service against the hashing cost itself.

## Monitoring and Observability

- Each successful registration SHALL be logged with the created customer identifier and the time, carrying no further personal data.
- Each successful sign-in SHALL be logged with the customer identifier, the session identifier, and the source address, so a session can be traced to where it was established.
- Each failed sign-in SHALL be logged with the source address and SHALL NOT record the submitted email address, so a failure log does not accumulate addresses that were never accounts.
- Each sign-out SHALL be logged with the session identifier.
- An elevated rate of failed sign-ins from one source SHALL be detectable, since that is the observable signature of credential guessing.

## References

### Related Specs

- `cart.md` — the guest cart merged into the customer's cart at sign-in
- `orders.md` — the customer order history resolved from the session
- `checkout.md` — the authenticated surface that places an order
- `saved-addresses.md` — the per-customer address book resolved from the session
- `internal-authentication.md` — service-to-service authentication of the internal API
