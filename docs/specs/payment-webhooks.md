# Payment Webhooks

## Overview

When a customer completes a payment, the payment provider notifies the system by webhook. The system verifies that the notification genuinely came from the provider, acknowledges it immediately, and settles the corresponding order in the background: the order moves to `paid`, the settlement time is recorded, and the provider's transaction reference is stored for reconciliation. Acknowledging before processing keeps the provider's delivery window short; processing in the background makes settlement survive a transient failure, because the provider retries a delivery it never saw acknowledged and the work itself is retried independently.

Webhook deliveries are at-least-once: the same event can arrive several times, and a settlement that already happened must not happen twice. Settlement is therefore idempotent at two levels — repeated deliveries of one event collapse onto a single unit of work, and settling an already-settled order changes nothing.

This specification covers webhook reception and verification, which events settle an order, the settlement itself, and the idempotency and reliability guarantees around it. The order record, its statuses, and its payment fields are owned by `orders.md`; placing the order that a payment settles is owned by `checkout.md`. The initial provider is Stripe.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define webhook authenticity verification and the acknowledgement contract that governs provider retries
- Define which events settle an order and how an event is matched to one
- Define settlement: the status transition and the payment metadata recorded
- Define the idempotency guarantees that make repeated delivery of one event safe
- Define what happens when an event matches no order, and why that is not a failure

### Non-Goals

- Initiating payments and creating checkout sessions with the provider
- Refunds, disputes, chargebacks, and subscription lifecycle events
- Managing customer records held by the payment provider
- Payment reconciliation and financial reporting
- Retrying a failed payment — the provider owns that
- Partial payments and multi-payment orders
- Storing the full provider event payload as an audit trail

## Functional Requirements

### FR-1: Webhook Reception

- The system SHALL expose `POST /api/v2/webhooks/payments` to receive provider payment events.
- The system SHALL verify each event's signature against the configured webhook secret before any other processing, using the request's raw body exactly as received (CON-2, LIM-1).
- The system SHALL reject an event whose signature is absent or does not verify, and SHALL NOT process it (Error Scenarios).
- The system SHALL acknowledge a verified event as soon as it has been queued for processing, without waiting for that processing to finish (LIM-2).
- The system SHALL respond with a server error when it cannot accept an event for processing, so the provider retries the delivery (FR-6, CON-1).

### FR-2: Event Selection

- The system SHALL settle an order only from a completed checkout-session event whose payment status is `paid`.
- The system SHALL acknowledge any other event type without processing it, so an unrecognized or unhandled event is not retried indefinitely by the provider (LIM-3).
- The system SHALL take the order reference from the checkout session's `client_reference_id` field.

### FR-3: Settlement

- The system SHALL locate the order whose `orderNumber` matches the event's order reference.
- Settlement SHALL set the order's status to `paid`, record `paidAt`, and store the provider's payment transaction reference in `paymentTransactionId` (`orders.md` FR-1, CON-4).
- Settlement of an order already in `paid` status SHALL make no change and SHALL complete successfully (LIM-4).
- When no order matches the reference, the system SHALL record the fact and complete successfully rather than fail, so an event for an order this system does not own is not retried forever (LIM-5, Monitoring).

### FR-4: Idempotency

- Repeated deliveries of the same provider event SHALL result in at most one settlement (LIM-6).
- Settlement SHALL additionally be idempotent in its own right, so that even a duplicate that escapes deduplication leaves the order unchanged (LIM-4).
- The system SHALL NOT rely on the provider delivering each event exactly once (CON-1).

### FR-5: Configuration

- The webhook secret SHALL be supplied through the `STRIPE_WEBHOOK_SECRET` environment variable.

### FR-6: Reliable Processing

- A verified, qualifying event SHALL be processed by a durable background execution that survives process restarts and retries transient failures on its own, rather than being processed inline within the request (CON-3).
- A failure to complete settlement SHALL NOT be reported to the provider as a delivery failure once the event has been accepted, since the retry belongs to the background execution rather than to the delivery.

## Technical Requirements (System Limits)

- **LIM-1 — Verification precedes parsing.** No field of an event body is acted upon before the signature over the raw body verifies; a modified body cannot alter a verified signature's meaning. (FR-1; Security)
- **LIM-2 — Acknowledge before processing.** A verified event is acknowledged as soon as it is queued, so the acknowledgement time does not depend on how long settlement takes. (FR-1)
- **LIM-3 — Unhandled events are acknowledged, not rejected.** An event outside the handled set is acknowledged successfully and produces no change, so the provider does not retry it. (FR-2)
- **LIM-4 — Settlement is idempotent.** Settling an order already in `paid` status changes nothing: the status, `paidAt`, and `paymentTransactionId` all keep the values recorded by the first settlement. (FR-3, FR-4)
- **LIM-5 — An unmatched reference is not a failure.** An event whose order reference matches no order completes successfully and changes nothing; it is recorded, not retried. (FR-3)
- **LIM-6 — One settlement per event.** Repeated deliveries carrying the same provider event identifier collapse onto a single unit of work; the second and later deliveries start nothing new. (FR-4)

## Constraints (Externally Imposed)

- **CON-1 — At-least-once delivery.** The provider may deliver one event several times and retries any delivery it does not see acknowledged. Both the deduplication in LIM-6 and the idempotence in LIM-4 exist because of this, not as belt-and-braces. (FR-1, FR-4)
- **CON-2 — Provider signature scheme.** The signature header, the secret, and the verification algorithm are defined by the payment provider; verification requires the request body byte-for-byte as sent, so any body parsing that rewrites it must not precede verification. (FR-1, LIM-1)
- **CON-3 — Durable execution substrate.** Reliable background processing, its retry behavior, and the deduplication key that collapses repeated deliveries are provided by the workflow engine the system runs on, not by this feature. (FR-6, LIM-6)
- **CON-4 — Order record ownership.** The order's status vocabulary, `paidAt`, and `paymentTransactionId` are owned by `orders.md`; this feature writes them and does not define them. (FR-3)
- **CON-5 — Single provider.** Only Stripe is supported; the event vocabulary, the `client_reference_id` carrying the order reference, and the signature scheme are all Stripe's. (FR-1, FR-2)

## Error Scenarios

| Scenario | Response |
|---|---|
| Signature header absent, or signature does not verify | HTTP 400 — invalid webhook signature; nothing is processed |
| Event type outside the handled set | HTTP 200 — acknowledged, not processed |
| Completed checkout session whose payment status is not `paid` | HTTP 200 — acknowledged, not processed |
| Order reference matches no order | Settlement completes successfully; the unmatched reference is recorded |
| Order already in `paid` status | Settlement completes successfully; nothing changes |
| Same event delivered more than once | At most one settlement occurs; later deliveries are acknowledged |
| Event cannot be queued for processing | HTTP 500 — the provider retries the delivery |
| Settlement fails after the event was acknowledged | Retried by the background execution; not reported to the provider |

## Security Considerations

- Every event SHALL be signature-verified against the configured secret before any of its fields are acted upon, so an unauthenticated caller cannot mark an order paid by posting a forged event (FR-1, LIM-1).
- Verification SHALL use the raw request body, since re-serializing the body invalidates the signature and any verification that tolerates that is not verifying anything (CON-2).
- The webhook secret SHALL be supplied as deployment configuration and SHALL never appear in a response or a log entry (FR-5).
- The endpoint SHALL disclose nothing about whether an order reference exists: a valid event for an unknown order and one for a known order are indistinguishable in the response (LIM-5).
- Settlement SHALL be reachable only through a verified event, so the `paid` status is never set by an unauthenticated request (FR-1, FR-3).

## Monitoring and Observability

- An event whose order reference matches no order SHALL be recorded with the reference, since it is the observable signature of a mismatch between what the provider was told and what this system holds.
- A signature verification failure SHALL be recorded, as a sustained rate of them indicates either a stale secret or a forgery attempt.
- Settlement outcomes SHALL be traceable from the provider event to the order settled, so a customer's payment can be followed end to end.

## References

### Related Specs

- `orders.md` — the order record, the `paid` status, `paidAt`, and `paymentTransactionId`
- `checkout.md` — placing the confirmed order that a payment later settles
