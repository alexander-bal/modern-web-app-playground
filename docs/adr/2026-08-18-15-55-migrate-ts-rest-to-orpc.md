# Migrate API Contracts from ts-rest to oRPC v1

**Status:** accepted
**Date:** 2026-08-18 15:55
**Supersedes:** `docs/adr/2026-03-05-11-11-shared-api-contracts.md` (its "Decision: keep ts-rest" section and 2026-08-18 addendum)

## Context

`docs/adr/2026-03-05-11-11-shared-api-contracts.md` established `@mercado/api-contracts` on ts-rest and, in an addendum added earlier the same day as this ADR, explicitly named `@ts-rest/*` becoming unmaintained as the trigger condition to revisit. That trigger fired: ts-rest's GitHub `main` branch had zero commits since 2025-06-02 (14+ months at time of writing), and its last release (`3.53.0-rc.1`) never left release-candidate — `latest` on npm was still `3.52.1` from March 2025.

The same addendum also flagged two concrete integration risks blocking a switch to oRPC:
1. Whether oRPC's Fastify integration (`OpenAPIHandler`, a catch-all route handler) correctly inherits Fastify's per-scope hooks — specifically the session-cookie `authPlugin` hook that gates every protected route.
2. Whether oRPC's client-side `safe()`/`isDefinedError()` pattern can cleanly replace ts-rest's `{status, body}` discriminated-union responses across endpoints with many distinct error shapes (`orders.update` had 6: 200/400/401/404/409/500).

Both were resolved by direct, in-repo verification before any production code changed: a throwaway prototype (`orders.orpc-prototype.ts`, removed after verification) mounted oRPC's `OpenAPIHandler` inside the same Fastify scope as `authPlugin` and confirmed the hook applies correctly; a second pass spiked `safe()`/`isDefinedError()` against orders' `getById` (5 status codes) before committing frontend code to the pattern. Findings are preserved in the 2026-08-18 addendum this ADR supersedes.

## Decision

Migrate `@mercado/api-contracts` and both consuming apps from ts-rest to **oRPC v1** (`^1.15.0`) — not v2, which exists only as an undocumented beta (`2.0.0-beta.28`, no migration guide, no stable release) at time of writing. The migration executed module-by-module (orders → products → cart → auth → addresses → checkout), each phase gated on typecheck, the full backend test suite, the smoke test, and relevant Playwright e2e specs, then reviewed (bug/security/performance/comment/UX/external-Codex) before proceeding. A final cleanup phase removed all `@ts-rest/*` packages, dependencies, and code.

### Contract shape

```typescript
// packages/api-contracts/src/{module}/contract.ts
import { oc } from '@orpc/contract';
import { commonErrors } from '../shared/errors.js';

const getById = oc
  .route({ method: 'GET', path: '/{id}', summary: 'Get an order by ID' })
  .input(z.object({ id: z.string().uuid() }))
  .output(orderWithItemsResponseSchema)
  .errors({
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

export const ordersOrpcContract = { getById /* , ...rest */ };
```

Contract paths are relative to the module's Fastify mount prefix (`orders` mounts at `/api/orders`, so `getById`'s path is `/{id}`, not `/api/orders/{id}`) — there is no combined root contract like ts-rest's `apiContract`; each module mounts independently.

### Shared named-error convention

A single `commonErrors` map (`packages/api-contracts/src/shared/errors.ts`) replaces per-endpoint inline error schemas: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `CONFLICT` (409), `UNPROCESSABLE_ENTITY` (422), each carrying the existing Zod error-body schema. 500 stays implicit (oRPC's default for unhandled throws). Every contract declares `.errors({...})` with just the codes it can return.

### Backend handlers

```typescript
// apps/backend/src/modules/{module}/api/{module}.routes.ts
const os = implement(ordersOrpcContract).$context<OrdersOrpcContext>();

const getById = os.getById.handler(async ({ input, context, errors }) => {
  const order = await ordersService.getById(input.id, context.userId);
  if (!order) throw errors.NOT_FOUND({ data: { error: 'Order not found' } });
  return order;
});

export const ordersOrpcRouter = os.router({ getById });
```

Handlers return the success body directly and `throw errors.CODE({data})` instead of ts-rest's `{status, body}` tuple. Route files export the router object; mounting is centralized in `apps/backend/src/config/orpc-mount.ts`'s `mountOrpcModule()`, called once per module from `apps/backend/src/app.ts`. Verified empirically: one Fastify catch-all per module at that module's own disjoint path prefix works; two catch-alls sharing a wildcard pattern across sibling scopes collide (`FST_ERR_DUPLICATED_ROUTE`).

### Error wire shape preserved

oRPC's default error envelope (`{code, message, status, data, defined}`) is overridden via `customErrorResponseBodyEncoder`/`customErrorResponseBodyDecoder` (`apps/backend/src/config/orpc.ts`, `apps/web/src/lib/api-client.ts`) to keep the historical flat `{error: string, details?}` body — zero wire-format change for any consumer that doesn't care about the migration (MSW mocks, Playwright specs asserting on raw REST responses).

### Frontend client

```typescript
// apps/web/src/lib/api-client.ts
const link = new OpenAPILink(ordersOrpcContract, { url: `${origin}/api/orders`, customErrorResponseBodyDecoder });
const ordersOrpcClient = createORPCClient(link);

export const orpc = {
  orders: createTanstackQueryUtils(ordersOrpcClient, { path: ['orders'] }),
  // ...one entry per module
};
```

`path: ['orders']` is required per module — omitting it lets same-named procedures across modules (two modules each with a `list` procedure) collide on the same TanStack Query cache-key root (found by the mandated bug-reviewer pass during the addresses phase; fixed before merge).

Components use `useQuery(orpc.X.Y.queryOptions())` / `useMutation(orpc.X.Y.mutationOptions())`; imperative call sites (contexts, non-hook code) use the raw client with `safe()`/`isDefinedError()`. `.queryKey()` (exact key) is required for `getQueryData`/`setQueryData` in optimistic updates — `.key()` returns a partial key safe only for `invalidateQueries`; conflating the two caused a real, caught-by-review bug where optimistic cart updates silently wrote to a phantom cache entry.

### OpenAPI generation

`apps/backend/src/config/openapi.ts` combines all six module contracts via `enhanceContractRouter(contract, {prefix, tags})` and generates the spec with `@orpc/openapi`'s `OpenAPIGenerator` + `ZodToJsonSchemaConverter` (from `@orpc/zod`). Per-operation `security` (session-cookie vs. public) is derived from each module's known Fastify mount scope (`requiresSessionCookie()`), not inferred from the contract, since oRPC contracts carry no security metadata by default. Both `apps/backend/src/scripts/generate-openapi.ts` (CLI, `pnpm openapi:generate`) and `app.ts`'s `/docs` Swagger UI call the same `generateOpenApiSpec()`.

## Consequences

### Positive

- **Unblocked from an unmaintained dependency.** `@ts-rest/*` is fully removed from the dependency tree (`pnpm-workspace.yaml` catalog, all three `package.json` files) — 8 packages dropped from the lockfile.
- **OpenAPI coverage is now complete.** ts-rest's generator only ever covered a shrinking subset of contracts as modules migrated to a prior, abandoned oRPC prototype (orders/products/cart were undocumented in `/docs` even before this migration started, per this ADR's own historical trigger). All 18 endpoints across 6 modules now generate correctly (`pnpm openapi:generate:lint` — 0 errors).
- **Fewer, more consistent error-handling patterns.** One named-error convention (`commonErrors`) replaces six modules' worth of ad-hoc inline error schemas; `isDefinedError(err) && err.code === 'X'` replaces `err.status === 400 ? ... : err.status === 422 ? ...` chains.
- **Simpler success-path types.** Handlers return `T` and throw on error, instead of every call site narrowing a `{status: 200, body: T} | {status: 400, body: E} | ...` union.

### Negative

- **Response validation now always runs** (oRPC's `.output()` is validated on every call, in every environment), vs. ts-rest's `responseValidation: env.NODE_ENV !== 'production'` split. Accepted: none of the 24 endpoints stream or return `ReadableStream`, so the validation-cost concern that split existed for doesn't apply here — but this is a deliberate, permanent behavior change, not an oversight.
- **A handful of specific 500-path error messages became generic.** `OrderNumberGenerationError`'s actionable message ("Unable to generate order number, please try again") is no longer surfaced to the client — unhandled throws fall through to oRPC's default `{error: 'Internal server error'}` rather than a named `.errors()` entry, since 500 was deliberately excluded from the shared error convention. Same trade-off applies to any other module's previously-caught-and-messaged 500 path.
- **Migration cost was real**, matching this ADR's predecessor's stated concern: six contract files, six route files, the frontend client, and the OpenAPI generator all changed. Mitigated by phasing (one module at a time, each independently verified and reviewed) rather than a single cutover.

### AI-Friendliness Impact

- **Discoverability**: 5/5 — `@mercado/api-contracts`' public exports (`ordersOrpcContract`, etc.) are the only way to reach a module's contract; no root re-export to search past.
- **Cohesion**: 5/5 — contract, error map, and mount prefix all live beside each other per module; `config/openapi.ts` and `config/orpc-mount.ts` are the only cross-cutting files, both small and single-purpose.
- **Pattern consistency**: 5/5 — all six modules (24 endpoints) follow the identical `contract.ts` (`oc` builder) + `schemas.ts` (Zod) + `{module}.routes.ts` (`implement()`) structure; verified via the mandated per-phase reviewer pass rather than assumed.
- **Type coverage**: 5/5 — `implement(contract).$context<T>()` types `context`, `input`, and `errors.CODE()` end-to-end from the contract; client-side `orpc.X.Y.queryOptions()` infers input/output the same way ts-rest's `initClient` did.
- **Traceability**: 4/5 — `mountOrpcModule()` in `app.ts` is one indirection between "which Fastify scope is this endpoint in" and the contract itself, vs. ts-rest's more explicit inline `s.registerRouter(contract, router, fastify, options)` per module. Documented in `docs/architecture/api-contracts.md`.

**Overall AI-friendliness: 4.8/5**

## Migration Path (as executed)

1. **Shared building blocks** (`commonErrors`, `apps/backend/src/config/orpc.ts`, `apps/backend/src/config/orpc-mount.ts`) built once against the orders module, reused verbatim by every later phase.
2. **Orders** (protected scope, worst-case 6-status-code endpoint) — proved the mount pattern and the `safe()`/`isDefinedError()` client pattern.
3. **Products** (unprotected scope) — proved the unprotected-scope mount variant.
4. **Cart** (unprotected scope, optional auth context) — proved optimistic-update cache-key handling; found and fixed the `.key()` vs `.queryKey()` bug here.
5. **Auth** (imperative-only client, cookie side-channel removed in favor of passing `reply` through oRPC context).
6. **Addresses** (protected scope, `204`/`z.undefined()` DELETE; found and fixed the missing per-module `path` option causing cross-module cache-key collisions, and a path-vs-body `id` precedence issue via `inputStructure: 'detailed'`).
7. **Checkout** (protected scope, applied the by-then-proven error pattern to the highest-risk frontend mutation last, per plan).
8. **Cleanup** (this phase) — `@orpc/openapi`'s `OpenAPIGenerator` replaced `@ts-rest/open-api`; all `@ts-rest/*` dependencies, the `tsr`/`api` frontend clients, `<tsr.ReactQueryProvider>`, and `tsRestRouterOptions` removed; `docs/architecture/overview.md` and `docs/architecture/api-contracts.md` updated; this ADR written.

Each numbered phase was independently typechecked, tested (full backend suite + relevant Playwright specs + smoke test), and reviewed (bug/security/performance/comment/UX/external-Codex reviewers) before the next began.
