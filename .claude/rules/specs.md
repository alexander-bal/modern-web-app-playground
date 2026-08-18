# Spec Writing — External Contract, Not Build Instructions

Specs live in `docs/specs/`, flat, one file per feature domain. Full conventions:
[`docs/specification-guide.md`](../../docs/specification-guide.md).

A spec states **what must be true from outside**, not how the system achieves it.

## The test

A line belongs only if it is verifiable from outside without reading the source.

- "A cart holds exactly one currency, fixed by its first item" — contract ✓
- "The cart module lives at `modules/cart/`" — build instruction ✗
- "Line totals carry exactly two decimal places" — contract ✓
- "Line totals use `numeric(15,2)`" — schema detail ✗
- "The system SHALL verify the webhook signature before acting on any field" — contract ✓
- "The endpoint SHALL use the `stripe` npm package" — build instruction ✗
- "The sidebar reflects a change made from any other surface without a reload" — contract ✓
- "`CartSidebar` reads the `['cart']` query cache" — internal name ✗

## Rules

- Tag every requirement: `FR-` (behavior, stated as SHALL), `LIM-` (a binding limit — a number,
  bound, or closed set that a test could assert), `CON-` (an externally imposed rule or substrate).
- Cross-reference by file and tag (`orders.md` LIM-2). Leave no dangling reference.
- Exactly one spec owns each behavior; the others cite it. Two specs stating one rule is how
  they start to disagree.
- Do NOT include: file paths, module or component names, package choices, schema and column
  tables, request/response examples, step-by-step data flow, test plans, risk registers,
  🚧 markers, future-enhancement lists, or changelogs.
- Keep wire vocabulary: field names, endpoints, status values, headers, cookies, environment
  variables.
- Describe the required state — never the current state, the limitation, or the change history.
  A deferred item is a Non-Goal, not a 🚧.
