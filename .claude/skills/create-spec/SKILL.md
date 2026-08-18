---
name: create-spec
description: >
  Write technical specification documents for new features or changes to existing features.
  Use proactively when the user asks to add a new feature, modify an existing feature, or
  explicitly requests a spec. Covers scope-boundary and ownership questions, requirements
  gathering, limits and constraints, edge cases, and self-review against the external-contract
  test. Outputs only spec .md files in docs/specs/ — does not implement code.
---

# Create Specification

Write feature specs following [`docs/specification-guide.md`](../../../docs/specification-guide.md).
Specs live in `docs/specs/`, flat, one file per feature domain.

Your role is spec author only — never implement code.

## The rule everything else follows from

A spec describes the system as an **external contract**. A line belongs only if it is
verifiable from outside without reading the source. Most drafting mistakes are one of two
things: writing an implementation plan instead of a contract, or restating a requirement
another spec already owns.

## Phase 1: Understand

1. Read `docs/specification-guide.md` — the test, the section order, the tagging conventions.
2. Read two existing specs in `docs/specs/` to calibrate altitude. `cart.md` (many surfaces, heavy
   cross-referencing) and `payment-webhooks.md` (small, constraint-driven) span the range.
3. Read `docs/architecture/overview.md` for system context.
4. Identify which existing spec **owns** each thing the feature touches. A new feature usually
   extends two or three existing contracts and owns only what is genuinely new.
5. List what you know versus what is ambiguous.

## Phase 2: Clarify

Ask before writing. Use `AskUserQuestion`, batching related questions into one call.

Ask about:

- **Scope boundary** — what this spec owns versus what an existing spec owns. Get this
  wrong and two specs will contradict each other later.
- **Observable acceptance** — what state means "done", stated so someone outside the code
  could check it.
- **Limits** — the numbers. Caps, lifetimes, page sizes, retry counts, precision, closed
  value sets. A spec with no `LIM-` entries is usually underspecified.
- **External constraints** — standards, provider behavior, delivery guarantees, platform
  rules the design must honor but did not choose.
- **Failure behavior** — what each rejection returns, and which failures deliberately succeed.
- **Security posture** — what must not leak, what must not be reachable, what identity is
  derived from.

Do not ask what you can read from the code or from an existing spec.

## Phase 3: Draft

Create `docs/specs/<domain>.md`. Use the section order from the guide:

```
Overview → Goals and Non-Goals → Functional Requirements (FR-)
→ Technical Requirements / System Limits (LIM-) → Constraints (CON-)
→ Error Scenarios → Security Considerations → Monitoring and Observability → References
```

Write the Overview's **scope-boundary paragraph first** — naming which spec owns each
adjacent thing. It determines what belongs in the rest of the document.

Then:

- State every requirement as SHALL / SHALL NOT. Reserve SHOULD and MAY for genuine optionality.
- Tag and cross-reference: `FR-`, `LIM-`, `CON-`, each citing the others that realize it, and
  citing other specs by file and tag (`orders.md` LIM-2). Leave no dangling reference.
- Keep wire vocabulary in backticks — field names, endpoints, status values, headers, cookies,
  environment variables. Drop internal names entirely.
- Describe the required state. No "currently", "will be added", "this replaces", no 🚧,
  no changelog, no future-enhancements section — a deferred item is a Non-Goal.

Cover the paths that are easy to omit: concurrent access, idempotency and repeated delivery,
partial failure and atomicity, empty and first-use states, expiry, and the cases that
deliberately succeed where a reader would expect an error.

## Phase 4: Review

Re-read the draft against these, and revise until each holds:

| Check | Failure looks like |
|---|---|
| Every line passes the external-contract test | File paths, component names, cache keys, schema columns, call ordering |
| Ownership is singular | This spec restates a rule another spec already owns |
| Limits are assertable | A `LIM-` with no number, bound, or closed set |
| Constraints are load-bearing | A `CON-` no requirement leans on |
| References resolve | A cited `FR-`/`LIM-` that does not exist, or a renamed tag with stale citations |
| Errors are complete | A rejection path in the requirements with no row in the table |
| Security is specific | "Input is validated" instead of what the guarantee prevents |

Do not append scores or a review table to the spec file.

## Phase 5: Finalize

1. Present the spec.
2. Summarize the decisions the clarification phase settled.
3. List the Non-Goals that were deferred rather than genuinely excluded.
4. Do not implement code — the spec is the deliverable.

## Updating an existing spec

1. Read the spec and every spec that cross-references it (`grep -rn "<file>.md" docs/specs/`).
2. Change the requirements that changed; leave the rest alone.
3. Keep tag numbers stable — a `LIM-3` cited from other specs stays `LIM-3`. Add new
   requirements at the next free number.
4. Update citations in other specs when a tag's meaning changes.
5. Record no changelog. The spec states the contract as it now is; git holds the history.

## Pitfalls

- **An implementation plan wearing spec clothes** — numbered data-flow steps, module layouts,
  package choices. Ask what a caller would observe, and write that instead.
- **A schema table** — replace with the observable property. `numeric(15,2)` becomes "carries
  exactly two decimal places".
- **Duplicated ownership** — the same rule stated in two specs. Pick an owner; the other cites it.
- **A spec per surface** — a sidebar, a page, and a list widget for one domain are `FR-`
  entries in that domain's spec, not three specs.
- **Vague requirements** — "the system should be fast". If it cannot fail a test, it is not
  a requirement.
- **Scope creep** — push back and propose a Non-Goal.
