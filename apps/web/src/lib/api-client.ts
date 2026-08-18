import {
  addressesOrpcContract,
  authOrpcContract,
  cartOrpcContract,
  checkoutOrpcContract,
  ordersOrpcContract,
  productsOrpcContract,
  statusToCommonErrorCode,
} from '@mercado/api-contracts';
import { createORPCClient, ORPCError } from '@orpc/client';
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';

function decodeCommonErrorResponseBody(deserializedBody: unknown, response: { status: number }) {
  const code = statusToCommonErrorCode[response.status];
  if (!code) {
    return undefined;
  }

  // Prefer the server's specific message (e.g. "Order with ID X not found") over
  // oRPC's generic per-code fallback, which doesn't even cover our custom codes.
  const message =
    typeof deserializedBody === 'object' &&
    deserializedBody !== null &&
    'error' in deserializedBody &&
    typeof deserializedBody.error === 'string'
      ? deserializedBody.error
      : undefined;

  return new ORPCError(code, {
    status: response.status,
    data: deserializedBody,
    defined: true,
    message,
  });
}

/** Builds the raw callable client for one oRPC module, mounted at `/api/${prefix}`. */
function createModuleOrpcClient<T extends AnyContractRouter>(contract: T, prefix: string) {
  const link = new OpenAPILink(contract, {
    // OpenAPILink requires an absolute URL — it calls `new URL()` internally.
    url: `${window.location.origin}/api/${prefix}`,
    fetch: (request, init) => fetch(request, { ...init, credentials: 'include' }),
    customErrorResponseBodyDecoder: decodeCommonErrorResponseBody,
  });

  return createORPCClient<ContractRouterClient<T>>(link);
}

const ordersOrpcClient = createModuleOrpcClient(ordersOrpcContract, 'orders');
const productsOrpcClient = createModuleOrpcClient(productsOrpcContract, 'products');
const cartOrpcClient = createModuleOrpcClient(cartOrpcContract, 'cart');
const addressesOrpcClient = createModuleOrpcClient(addressesOrpcContract, 'v1/addresses');
const checkoutOrpcClient = createModuleOrpcClient(checkoutOrpcContract, 'checkout');

/** Auth is called imperatively (no hooks), so only the raw client is needed. */
export const authClient = createModuleOrpcClient(authOrpcContract, 'auth');

export const orpc = {
  orders: createTanstackQueryUtils(ordersOrpcClient, { path: ['orders'] }),
  products: createTanstackQueryUtils(productsOrpcClient, { path: ['products'] }),
  cart: createTanstackQueryUtils(cartOrpcClient, { path: ['cart'] }),
  addresses: createTanstackQueryUtils(addressesOrpcClient, { path: ['addresses'] }),
  checkout: createTanstackQueryUtils(checkoutOrpcClient, { path: ['checkout'] }),
};
