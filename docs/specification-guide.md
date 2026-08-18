# Specification Guide

How to write a spec in this repository. Specs live in [`docs/specs/`](./specs/), one flat directory, one file per feature domain.

A spec describes the system as an **external contract** — what must be true, not how it is built.

## The test

A line belongs in a spec only if it is **verifiable from outside without reading the source**.

Apply it to every line before writing it. Most of what fails the test is not wrong, it is just something else: a design note, a schema, a test plan, an implementation sketch. Those belong in code, in an ADR, or nowhere.

| Line | Verdict |
|---|---|
| "A cart holds exactly one currency, fixed by its first item" | ✅ observable from the API |
| "The cart module lives at `modules/cart/`" | ❌ file path |
| "Line totals use `numeric(15,2)` to avoid float errors" | ❌ schema detail — say "carry exactly two decimal places" |
| "A guest cart expires 30 days after last modification" | ✅ observable by waiting |
| "`CartSidebar` reads the `['cart']` query cache" | ❌ internal component and cache key |
| "The sidebar reflects a change made from any other surface without a reload" | ✅ same behavior, stated observably |

## Include

- **Functional Requirements** (`FR-`) — required behavior, stated as SHALL.
- **Technical Requirements** (`LIM-`) — binding limits on observable behavior: size caps, lifetimes, precision, closed vocabularies, isolation guarantees.
- **Constraints** (`CON-`) — externally imposed rules and substrates: standards, wire protocols, platform behavior, another spec's ownership.
- **Error Scenarios** — the input → response contract, as a table.
- **Security Considerations** — what each guarantee protects against, and why.
- **Monitoring and Observability** — what must be observable, and what a signal means.

## Exclude

- Schema and column tables, config shapes, type definitions, request/response JSON examples.
- Internal names: modules, functions, classes, components, hooks, cache keys, npm packages.
- File paths and line numbers.
- Step-by-step data flow and call ordering ("1. Handler validates… 2. Service queries…").
- Design rationale, risk registers, alternatives considered — those belong in an ADR.
- Test plans and QA checklists at every level (unit, integration, E2E, manual).
- Status markers (🚧), "future enhancements", changelogs, review sign-off blocks.

## Keep as vocabulary

Entity, field, and enum names; endpoints; status values; header, cookie, and environment-variable names; protocol terms. These are the contract, not implementation detail. Write them as they appear on the wire.

## Section order

Every spec uses these headings, in this order. Omit a section only when the feature genuinely has nothing to say under it.

```
# Title

## Overview
## Goals and Non-Goals
### Goals
### Non-Goals
## Functional Requirements
### FR-1: <title>
## Technical Requirements (System Limits)
## Constraints (Externally Imposed)
## Error Scenarios
## Security Considerations
## Monitoring and Observability
## References
### Related Specs
### Related ADRs
```

### Overview

Three paragraphs:

1. **What the feature is** and what it does, in the language a reader who has never seen the code would use.
2. **The scope boundary** — what this spec owns, and which spec owns each adjacent thing. Name the files.
3. The fixed line: *"This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document."*

The boundary paragraph is the one that keeps a set of specs from drifting into mutual contradiction. Write it before the requirements, not after.

### Goals and Non-Goals

Goals: what this spec defines. Non-Goals: what it deliberately does not — each either a genuine exclusion or a pointer to the spec that owns it. A Non-Goal is where a "future enhancement" belongs.

### Functional Requirements

Numbered `FR-1`, `FR-2`, … each with a short title, each a group of SHALL bullets. Cite the `LIM-` and `CON-` tags that bind it, and the requirements in other specs it depends on (`cart.md` FR-7).

### Technical Requirements (System Limits)

`LIM-` entries in bold-lead form, each naming the limit and citing where it is realized:

```markdown
- **LIM-4 — Guest cart lifetime.** A guest cart and its `cart_token` cookie both expire
  30 days after the cart was last modified, and every modification restarts that 30 days.
  A cart past its expiry is not found. (FR-2)
```

A `LIM-` is a number, a bound, or a closed set that a test could assert against. If it cannot fail, it is not a limit.

### Constraints (Externally Imposed)

`CON-` entries in the same form, for rules the design must honor but did not choose: a standard (ISO 4217), a protocol behavior (at-least-once webhook delivery), a platform guarantee (browser cookie semantics), or another spec's ownership. State *why* it constrains this feature — a constraint no requirement leans on does not belong.

### Error Scenarios

A two-column table: `| Scenario | Response |`. Cover every rejection path, plus the cases that deliberately succeed where a reader might expect failure ("order already paid → completes successfully, nothing changes").

### Security Considerations

One bullet per guarantee, each naming the attack or leak it prevents and citing the `FR-`/`LIM-` that carries it. "Input is validated" says nothing; "an address belonging to another customer is reported as not found rather than forbidden, so the response does not confirm the identifier exists" says something.

### Monitoring and Observability

What must be observable and what its absence or spike means. Not a dashboard design.

## Requirement language

RFC 2119, and mean it:

- **SHALL** — required. The default. Anything a reader could rely on.
- **SHALL NOT** — prohibited. Prefer it to a hedged SHALL.
- **SHOULD** — recommended, with a real reason to deviate. Rare.
- **MAY** — genuinely optional; a conforming system may do either.

Use natural language for names in prose ("order status", "cart token"), and exact identifiers in backticks when they are the wire contract (`orderNumber`, `cart_token`, `X-User-Email`).

## Cross-references

Tags are addressable: cite them as `cart.md` FR-7, `orders.md` LIM-2. Leave no dangling reference — if you cite a tag, it exists; if you rename one, update its citations. When two specs touch the same behavior, exactly one owns it and the other references it. Two specs stating the same rule is how they start to disagree.

## Describe the required state

Write the system as it must be, not how it got there. No "currently", "previously", "will be added", "this replaces", "changes to the orders table". A spec that reads as a diff stops being readable the moment the diff lands.

## Creating and updating

**New spec**: pick a slug matching the existing files (lowercase, hyphenated, named for the domain — `saved-addresses.md`, not `add-address-feature.md`). One file per domain: surfaces belonging to one domain go in that domain's spec as their own `FR-`, not in a spec of their own.

**Existing spec**: change the requirements that changed. Keep tag numbers stable — a `LIM-3` cited from three other specs stays `LIM-3`. Add new requirements at the next free number. Do not record what changed; the spec states the contract as it now is, and git holds the history.

Update the spec in the same change as the code.
