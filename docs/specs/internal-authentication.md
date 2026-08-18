# Internal Authentication

## Overview

Internal authentication guards the service-to-service surface of the API. A calling service presents a long-lived API token as a bearer credential; the system compares it against the tokens it was configured with and rejects anything else. A call made on a person's behalf may additionally carry that person's identity in request headers, which the system attaches to the request context and to its logs, so an action taken through a calling service remains traceable to the person who initiated it.

Several valid tokens may be configured at once. That is what makes rotation possible without downtime — a new token is added, callers move to it, the old one is withdrawn — and it allows a distinct token per calling service, so logs and revocation can be scoped to one caller rather than to all of them.

This specification covers token validation, user-identity extraction, which routes the guard covers, and the failure contract. Browser-facing authentication — customer accounts, passwords, and session cookies — is owned by `auth.md`; the two surfaces are separate, and a credential for one is never a credential for the other.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define the bearer-token contract for the internal API and the multiple-token configuration that makes rotation possible
- Define which routes the guard covers and which are deliberately exempt
- Define the optional user-identity headers, their effect on request context and logging, and their non-effect on authorization
- Define the failure contract, including what a failure response and a failure log may and may not contain
- Define the startup validation that prevents the service from running unguarded

### Non-Goals

- Browser-facing customer authentication — accounts, passwords, and sessions (`auth.md`)
- OAuth 2, JWT, SAML, and other federated or cryptographically verified credential formats
- Token expiry, refresh, and automatic rotation — tokens are long-lived and withdrawn by reconfiguration
- Per-token scopes, per-route permissions, and any other authorization beyond "the token is valid"
- Token metadata, usage analytics, and a revocation list held at runtime
- Mutual TLS and request signing
- Rate limiting, which is applied independently of authentication

## Functional Requirements

### FR-1: Token Validation

- The system SHALL read the API token from the `Authorization` header using the `Bearer` scheme.
- The system SHALL accept a token that matches any of the tokens it was configured with, and SHALL reject every other token (LIM-1).
- The system SHALL compare tokens in constant time, so the comparison's duration reveals nothing about how much of a candidate token was correct (LIM-3; Security).
- The system SHALL accept the token only from the `Authorization` header, and SHALL NOT accept it from a query parameter, a cookie, or a request body (LIM-4; Security).
- The system SHALL reject a request whose token is missing, malformed, or unrecognized (Error Scenarios).

### FR-2: Configuration and Startup Validation

- Valid tokens SHALL be configured through the `API_BEARER_TOKENS` environment variable as a comma-separated list, with surrounding whitespace ignored (LIM-1).
- The system SHALL verify at startup that at least one token is configured and SHALL refuse to start otherwise, so the internal surface can never come up unguarded (LIM-2; Security).

### FR-3: User Identity Extraction

- The system SHALL read an optional user identity from the request headers `X-User-Id`, `X-User-Email`, and `X-User-Name`.
- These headers SHALL be optional: a service-to-service call carrying none of them SHALL be authenticated exactly as one that carries them.
- The system SHALL attach the extracted identity to the request context, so route handlers reach it without re-reading headers.
- The system SHALL include the user's email in the structured logs for the request when one was supplied (Monitoring).
- The extracted identity SHALL carry no authority: it SHALL NOT grant, widen, or restrict access, which is decided solely by the token (LIM-5; Security).
- The system SHALL bound the accepted length of each identity header and SHALL validate that the email header is well formed before using or logging it (LIM-6; Security).

### FR-4: Route Coverage

- The system SHALL require a valid token on every route under `/api/internal/`, applied by construction so that a newly added internal route is guarded without further action (LIM-7).
- The system SHALL exempt the liveness and readiness probes `/healthz` and `/ready`, which must answer before and independently of any credential being configured.
- The system SHALL exempt the API documentation at `/docs` and its assets.
- A request to a guarded route without a valid token SHALL be rejected before the route handler runs.

### FR-5: Failure Contract

- A rejected request SHALL receive a response that states the reason in general terms and SHALL disclose no configured token, nor any part of one, nor how many are configured (LIM-8; Security).
- A configuration or comparison failure SHALL be reported to the caller as an internal error, with the detail recorded server-side only.
- An authentication failure SHALL be logged with the request path and source address, and SHALL never record the presented token value (Monitoring, LIM-8).

## Technical Requirements (System Limits)

- **LIM-1 — Multiple configured tokens.** Any one of the configured tokens grants access; they are equivalent, and no route distinguishes between them. This is what allows a rotation window in which an old and a new token are both valid. (FR-1, FR-2)
- **LIM-2 — No unguarded start.** With `API_BEARER_TOKENS` unset or empty, the service does not start; there is no configuration in which the internal surface runs without a credential. (FR-2)
- **LIM-3 — Constant-time comparison.** Token comparison takes the same time regardless of how many leading characters match, so a valid token cannot be recovered by measuring responses. (FR-1)
- **LIM-4 — Header-only transport.** A token presented anywhere other than the `Authorization` header is not accepted, so tokens do not reach access logs, browser history, or referrer headers through a URL. (FR-1)
- **LIM-5 — Identity headers carry no authority.** `X-User-Id`, `X-User-Email`, and `X-User-Name` are context only; they never affect whether a request is authorized. A caller cannot gain access by asserting an identity. (FR-3)
- **LIM-6 — Bounded identity headers.** Each identity header is length-bounded and the email header is format-validated before it is used or logged. (FR-3)
- **LIM-7 — Universal coverage of the internal surface.** Every route under `/api/internal/` is guarded by construction rather than by per-route opt-in, so coverage does not depend on remembering to add a guard. (FR-4)
- **LIM-8 — No token disclosure.** No response body, error message, or log entry contains a configured or presented token, in whole or in part. (FR-5; Security)

## Constraints (Externally Imposed)

- **CON-1 — Bearer credentials can be replayed.** A bearer token is a shared secret with no expiry and no binding to the request: anyone holding it can use it until it is withdrawn. Transport confidentiality, custody of the configured values, and rotation are therefore what protect this surface, not the token format. (FR-1; Security)
- **CON-2 — Transport security.** Confidentiality of the token in transit is provided by TLS, not by this feature; over a plaintext connection the credential is exposed regardless of how it is compared. (FR-1; Security)
- **CON-3 — Configuration substrate.** Tokens arrive as process configuration; their generation, storage, custody, and rotation belong to the deployment's secret management, not to this feature. (FR-2)
- **CON-4 — Probe exemption.** Liveness and readiness probes are called by the platform's own machinery, which holds no credential; their exemption is imposed by that contract. (FR-4)
- **CON-5 — Separate from customer authentication.** Customer sessions (`auth.md`) and internal tokens are distinct credentials for distinct surfaces; neither is accepted where the other is expected. (Overview)

## Error Scenarios

| Scenario | Response |
|---|---|
| `Authorization` header absent on a guarded route | HTTP 401 — missing authentication token |
| `Authorization` header present but not a well-formed `Bearer` credential | HTTP 401 — malformed authentication token |
| Token presented that matches no configured token | HTTP 401 — invalid authentication token |
| Token presented in a query parameter, cookie, or body instead of the header | HTTP 401 — treated as absent |
| Identity headers supplied without a valid token | HTTP 401 — identity confers no access |
| Valid token with no identity headers | Authenticated; the request proceeds with no user context |
| Identity header exceeding its length bound or malformed email | Rejected as identity; the request is not authenticated on its basis |
| `API_BEARER_TOKENS` unset or empty at startup | The service does not start; the reason is logged |
| Unexpected failure during validation | HTTP 500 — generic message to the caller; full detail logged server-side |
| Request to `/healthz`, `/ready`, `/docs`, or a docs asset without a token | Served normally; these routes are exempt |

## Security Considerations

- Token comparison SHALL be constant-time, so response timing cannot be used to recover a valid token character by character (LIM-3).
- A token SHALL be accepted only from the `Authorization` header, so it is never captured by URL-logging intermediaries, browser history, or referrer headers (LIM-4).
- No token SHALL appear in any response, error message, or log entry, so an attacker who can read logs or trigger errors learns nothing about the credential (LIM-8).
- The service SHALL refuse to start without at least one configured token, so a misconfiguration cannot silently leave the internal surface open (LIM-2).
- User-identity headers SHALL never influence authorization, so a caller who reaches the surface cannot escalate by asserting a privileged identity (LIM-5).
- Identity headers SHALL be length-bounded and format-validated before being written to logs, so a caller cannot use them to inject content into the log stream (LIM-6).
- Because a bearer token can be replayed until it is withdrawn, deployments SHALL use a distinct high-entropy token per calling service and rotate them on a schedule, so a compromised credential can be attributed to one caller and withdrawn without disrupting the others (CON-1, CON-3, LIM-1).
- The internal surface SHALL be served over TLS, since the credential is exposed in full on any plaintext connection (CON-2).

## Monitoring and Observability

- Each authenticated request SHALL be logged with its path and method, and with the user's email when one was supplied, so an action can be attributed to the person who initiated it through the calling service.
- Each authentication failure SHALL be logged with its reason, the request path, and the source address — and never the presented token — so failures are diagnosable without the log becoming a credential store (LIM-8).
- A missing or empty token configuration SHALL be reported at startup as an error, since the service will not run and the reason must be visible.
- Repeated authentication failures from one source SHALL be detectable, as that is the observable signature of a caller with a withdrawn token or an attacker guessing one.

## References

### Related Specs

- `auth.md` — browser-facing customer authentication, sessions, and the separate credential they use
- `orders.md` — a management surface reached through the internal API
- `products.md` — a management surface reached through the internal API
