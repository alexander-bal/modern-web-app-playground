import {
  addressesOrpcContract,
  authOrpcContract,
  cartOrpcContract,
  checkoutOrpcContract,
  ordersOrpcContract,
  productsOrpcContract,
} from '@mercado/api-contracts';
import { enhanceContractRouter } from '@orpc/contract';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import type { JSONSchema } from 'json-schema-typed/draft-2020-12';
import type { OpenAPIV3_1 } from 'openapi-types';

/** Each module's contract paths are relative to its Fastify mount prefix (see `app.ts`). */
const MODULES = [
  { contract: ordersOrpcContract, prefix: '/api/orders', tags: ['Orders'] },
  { contract: productsOrpcContract, prefix: '/api/products', tags: ['Products'] },
  { contract: cartOrpcContract, prefix: '/api/cart', tags: ['Cart'] },
  { contract: authOrpcContract, prefix: '/api/auth', tags: ['Auth'] },
  { contract: addressesOrpcContract, prefix: '/api/v1/addresses', tags: ['Addresses'] },
  { contract: checkoutOrpcContract, prefix: '/api/checkout', tags: ['Checkout'] },
] as const;

const openApiTags = [
  { name: 'Orders', description: 'Order management endpoints' },
  { name: 'Products', description: 'Product catalog endpoints' },
  { name: 'Cart', description: 'Shopping cart endpoints' },
  { name: 'Auth', description: 'Registration, login, and session endpoints' },
  { name: 'Addresses', description: 'Saved address book endpoints' },
  { name: 'Checkout', description: 'Order placement endpoint' },
];

const openApiSecuritySchemes: Record<string, OpenAPIV3_1.SecuritySchemeObject> = {
  SessionCookie: {
    type: 'apiKey',
    in: 'cookie',
    name: 'sid',
    description: 'Session cookie set on login/register',
  },
};

const SESSION_COOKIE_SECURITY: OpenAPIV3_1.SecurityRequirementObject[] = [{ SessionCookie: [] }];
const NO_SECURITY: OpenAPIV3_1.SecurityRequirementObject[] = [];

/**
 * `/api/orders/*`, `/api/checkout`, and `/api/v1/addresses/*` are mounted inside the
 * `protectedInstance` scope, whose `authPlugin` hook rejects any request without a valid
 * `sid` session cookie before the handler runs (see `app.ts`, `infra/auth/auth.plugin.ts`).
 * `/api/products/*` and `/api/cart/*` are mounted unprotected, except `auth.me` and
 * `cart.mergeCart`, which validate the session cookie themselves in the handler (see
 * `auth.routes.ts`, `cart.routes.ts`) rather than being gated by mount scope.
 */
function requiresSessionCookie(path: string): boolean {
  if (path === '/api/auth/me' || path === '/api/cart/merge') {
    return true;
  }
  if (path.startsWith('/api/auth/')) {
    return false;
  }
  return (
    path.startsWith('/api/orders') ||
    path.startsWith('/api/checkout') ||
    path.startsWith('/api/v1/addresses')
  );
}

/** Assigns `security` per operation — the generator doesn't infer it from mount scope. */
function applySecurityRequirements(doc: OpenAPIV3_1.Document): void {
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    const security = requiresSessionCookie(path) ? SESSION_COOKIE_SECURITY : NO_SECURITY;
    for (const operation of Object.values(
      pathItem as Record<string, OpenAPIV3_1.OperationObject>
    )) {
      operation.security = security;
    }
  }
}

/** The wire body for every declared error is exactly its `data` schema (see `config/orpc.ts`). */
function customErrorResponseBodySchema(
  definedErrors: Array<
    [code: string, message: string, dataRequired: boolean, dataSchema: JSONSchema]
  >
): JSONSchema | undefined {
  const [first] = definedErrors;
  return first?.[3];
}

function buildCombinedContract() {
  return Object.fromEntries(
    MODULES.map(({ contract, prefix, tags }) => [
      prefix,
      enhanceContractRouter(contract, { errorMap: {}, prefix, tags }),
    ])
  );
}

export interface GenerateOpenApiSpecOptions {
  info: OpenAPIV3_1.InfoObject;
  servers: OpenAPIV3_1.ServerObject[];
}

export async function generateOpenApiSpec(
  options: GenerateOpenApiSpecOptions
): Promise<OpenAPIV3_1.Document> {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const doc = await generator.generate(buildCombinedContract(), {
    info: options.info,
    servers: options.servers,
    tags: openApiTags,
    components: {
      securitySchemes: openApiSecuritySchemes,
    },
    customErrorResponseBodySchema,
  });

  applySecurityRequirements(doc);

  return doc;
}
