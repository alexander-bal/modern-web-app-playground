# API Contracts Architecture

## Overview

`@mercado/api-contracts` is a shared workspace package that defines the entire API surface using [oRPC](https://orpc.dev/) contracts (`@orpc/contract`'s `oc` builder) and [Zod](https://zod.dev/) schemas. It is the single source of truth consumed by both backend (route handlers) and frontend (typed client).

**Key properties:**
- Compile-time type safety across the full stack
- Runtime request/response validation via Zod
- Automatic OpenAPI spec generation
- No code duplication between backend and frontend

## Package Structure

```
packages/api-contracts/src/
├── index.ts                    # Public API — re-exports all module contracts and schemas
├── shared/
│   ├── errors.ts               # Reusable named error definitions (`commonErrors`)
│   └── pagination.ts           # Pagination metadata schema
└── {module}/                   # One directory per module (e.g. cart/, products/)
    ├── contract.ts             # oRPC contract definition
    └── schemas.ts              # Zod I/O schemas
```

Dependencies: `@orpc/contract`, `zod` only.

## Contract Definition Pattern

Each module follows the same structure — a `contract.ts` using the `oc` builder and a `schemas.ts` with Zod schemas:

```typescript
// {module}/contract.ts
import { oc } from '@orpc/contract';
import { z } from 'zod';
import { commonErrors } from '../shared/errors.js';
import { listResponseSchema } from './schemas.js';

const list = oc
  .route({ method: 'GET', path: '/', summary: 'List items' })
  .input(z.object({ page: z.coerce.number().default(1) }))
  .output(listResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
  });

export const exampleOrpcContract = { list /* , ...more endpoints */ };
```

Contract paths are relative to the module's Fastify mount prefix (e.g. `products` mounts at `/api/products`, so its `list` route is `/`, not `/api/products`) — see `apps/backend/src/app.ts` for the mount table and `apps/backend/src/config/orpc-mount.ts` for the mounting helper.

There is no single combined router at the contract-package level (unlike a ts-rest-style `apiContract`) — each module's contract is mounted independently. `apps/backend/src/config/openapi.ts` combines all six for spec generation only, prefixing each with its mount path via `enhanceContractRouter`.

## Shared Schemas

### Error Responses (`shared/errors.ts`)

`commonErrors` is a named-error map — `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `CONFLICT` (409), `UNPROCESSABLE_ENTITY` (422) — each carrying the Zod schema for that status's response body. Every contract endpoint declares `.errors({...})` with the subset of these codes it can return; 500 stays implicit (oRPC's default for unhandled throws). All error bodies follow `{ error: string, details?: ... }` shape on the wire (see "Error Wire Shape" below).

### Pagination (`shared/pagination.ts`)

Standard pagination metadata (`total`, `page`, `limit`, `totalPages`) used in paginated list responses.

## Backend Consumption

**Pattern:** `implement()` in `apps/backend/src/modules/*/api/*.routes.ts`:

```typescript
import { productsOrpcContract } from '@mercado/api-contracts';
import { implement } from '@orpc/server';

const os = implement(productsOrpcContract).$context<{ userId?: string }>();

const list = os.list.handler(async ({ input, context, errors }) => {
  return await productService.list(input);
});

export const productsOrpcRouter = os.router({ list });
```

The handler returns the success body directly (or throws `errors.CODE({data: {...}})` for a declared error) — no `{status, body}` tuple. Route files export the built router object; Fastify mounting happens centrally via `mountOrpcModule()` (see `apps/backend/src/config/orpc-mount.ts`), called from `apps/backend/src/app.ts`, which also defines each module's context builder and split into public and protected (behind `authPlugin`) Fastify scopes.

## Frontend Consumption

**Single client** setup in `apps/web/src/lib/api-client.ts`, one `OpenAPILink`-backed client per module, wrapped with `createTanstackQueryUtils`:

```typescript
import { productsOrpcContract } from '@mercado/api-contracts';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';

const link = new OpenAPILink(productsOrpcContract, { url: `${window.location.origin}/api/products` });
const productsOrpcClient = createORPCClient(link);

export const orpc = {
  products: createTanstackQueryUtils(productsOrpcClient, { path: ['products'] }),
  // ...one entry per module
};
```

The `path` option namespaces each module's TanStack Query cache keys — omitting it lets same-named procedures in different modules (e.g. two modules with a `list` endpoint) collide on the same root key.

**Query pattern** (components):

```typescript
const { data, isPending } = useQuery(orpc.products.list.queryOptions({ input: { page } }));
```

**Mutation pattern**, using `isDefinedError()` to narrow on a declared error code instead of an HTTP status:

```typescript
import { isDefinedError } from '@orpc/client';

const mutation = useMutation(
  orpc.checkout.checkout.mutationOptions({
    onSuccess: (order) => { /* order is the success body directly */ },
    onError: (err) => {
      if (isDefinedError(err) && err.code === 'UNPROCESSABLE_ENTITY') { /* err.data.error */ }
    },
  })
);
mutation.mutate({ shippingAddress: { /* ... */ } });
```

**Imperative calls** (contexts, non-hook code) use the raw client directly and `safe()` for non-throwing error handling:

```typescript
import { safe, isDefinedError } from '@orpc/client';
import { authClient } from '../lib/api-client';

const [error, user] = await safe(authClient.me());
if (!error) { setUser(user); }
```

### Cache-key exactness

`.key()` on a `createTanstackQueryUtils` procedure returns a **partial** key — safe for `invalidateQueries` only. `.queryKey()` returns the **exact** key `queryOptions()` uses internally — required for `getQueryData`/`setQueryData` (optimistic updates), since those need an exact match.

### Error Wire Shape

By default oRPC's error envelope is `{code, message, status, data, defined}`. This API instead keeps the historical flat shape (`{error: string, details?}`) via `customErrorResponseBodyEncoder`/`customErrorResponseBodyDecoder` (`apps/backend/src/config/orpc.ts`, `apps/web/src/lib/api-client.ts`) — the client reconstructs a typed, `isDefinedError()`-matchable error from the flat body using `statusToCommonErrorCode` (`packages/api-contracts/src/shared/errors.ts`), since the flat body alone drops the `code`.

## OpenAPI Generation

OpenAPI 3.1 spec is generated from the module contracts via `@orpc/openapi`'s `OpenAPIGenerator` (`apps/backend/src/config/openapi.ts`, the single source of truth). Two consumption points:

- **Development server**: `app.ts` generates the spec at startup and serves it via Swagger UI at `/docs`. The `@fastify/swagger` plugin is registered as a minimal shell required by `@fastify/swagger-ui`, but the actual spec is replaced with the oRPC-generated one via `transformSpecification`.
- **CLI generation**: `apps/backend/src/scripts/generate-openapi.ts` outputs standalone JSON/YAML files for validation (`pnpm openapi:generate:lint` runs Redocly against it) and client generation.

Contracts' `summary` and `description` fields appear in the generated spec. Path params, input, and output schemas are extracted automatically from Zod definitions via `ZodToJsonSchemaConverter`. Per-operation `security` (session-cookie vs. public) is derived from each module's Fastify mount scope, not inferred from the contract — see `requiresSessionCookie()` in `config/openapi.ts`.

## Conventions

### Monetary Amounts

All prices and monetary values are string decimals (e.g. `"29.99"`), not floats:

```typescript
z.coerce.number().min(0).transform(val => val.toFixed(2))  // input
z.string()  // response — already formatted
```

### Enum Values

Defined as `const` arrays, exported as union types:

```typescript
const statusValues = ['draft', 'active', 'archived'] as const;
export type Status = typeof statusValues[number];
```

### Response Shape

Success responses are the plain output type — no status-keyed wrapper. Declared errors are thrown, not returned, and narrowed on the client via `isDefinedError(err) && err.code === 'CODE'`:

```typescript
// success
const order = await orpc.checkout.checkout.call(input); // Order

// error
if (isDefinedError(err) && err.code === 'NOT_FOUND') { /* ... */ }
```

### Naming

- Contract variables: `{module}OrpcContract` (e.g. `cartOrpcContract`)
- Schema variables: `{entity}{Purpose}Schema` (e.g. `addItemSchema`, `cartResponseSchema`)
- Contract paths: relative to the module's mount prefix (e.g. `/`, `/{id}`, `/by-slug/{slug}`) — never repeat the module name
