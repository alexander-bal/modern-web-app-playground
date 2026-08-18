import { cartOrpcContract } from '@mercado/api-contracts';
import { implement } from '@orpc/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { mountOrpcModule } from '../../../config/orpc-mount.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { authService } from '../../auth/index.js';
import type { CartIdentifier } from '../domain/cart.types.js';
import {
  CartItemNotFoundError,
  CartNotFoundError,
  CurrencyMismatchError,
  cartService,
  ProductNotAvailableError,
  ProductNotFoundError,
} from '../services/cart.service.js';

const logger = createModuleLogger('cart');

const CART_TOKEN_COOKIE_NAME = 'cart_token';

function setCartTokenCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(CART_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });
}

/**
 * Extract cart identifier from request.
 * Checks for authenticated user (session cookie) first, then cart_token cookie (guest).
 */
async function extractCartIdentifier(request: FastifyRequest): Promise<CartIdentifier> {
  if (request.user) {
    return { type: 'user', userId: request.user.id };
  }

  const sessionToken = request.cookies['sid'];
  if (sessionToken) {
    try {
      const user = await authService.validateSession(sessionToken);
      return { type: 'user', userId: user.id };
    } catch {
      // Session invalid or expired, treat as guest
    }
  }

  const cartToken = request.cookies[CART_TOKEN_COOKIE_NAME];
  if (cartToken) {
    return { type: 'guest', cartToken };
  }

  return { type: 'guest' };
}

export interface CartOrpcContext {
  identifier: CartIdentifier;
  userId: string | null;
  /** Carries the newly-issued guest cart token to the onSend hook, which sets the cookie. */
  request: FastifyRequest & { newCartToken?: string };
}

async function buildCartOrpcContext(request: FastifyRequest): Promise<CartOrpcContext> {
  const identifier = await extractCartIdentifier(request);

  return {
    identifier,
    userId: identifier.type === 'user' ? identifier.userId : null,
    request,
  };
}

const os = implement(cartOrpcContract).$context<CartOrpcContext>();

const getCart = os.getCart.handler(async ({ context }) => {
  try {
    return await cartService.getCart(context.identifier);
  } catch (error) {
    logger.error({ error }, 'Unexpected error in get cart route');
    throw error;
  }
});

const addItem = os.addItem.handler(async ({ input, context, errors }) => {
  try {
    const result = await cartService.addItem(context.identifier, input.productId, input.quantity);

    if (result.newCartToken) {
      context.request.newCartToken = result.newCartToken;
    }

    return result;
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: 'Product not found' } });
    }

    if (error instanceof ProductNotAvailableError) {
      throw errors.UNPROCESSABLE_ENTITY({ data: { error: 'Product is not available' } });
    }

    if (error instanceof CurrencyMismatchError) {
      throw errors.UNPROCESSABLE_ENTITY({
        data: { error: 'Product currency does not match cart currency' },
      });
    }

    logger.error({ error, input }, 'Unexpected error in add item route');
    throw error;
  }
});

const updateItem = os.updateItem.handler(async ({ input, context, errors }) => {
  try {
    return await cartService.updateItemQuantity(
      context.identifier,
      input.params.itemId,
      input.body.quantity
    );
  } catch (error) {
    if (error instanceof CartNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: 'Cart not found' } });
    }

    if (error instanceof CartItemNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: 'Cart item not found' } });
    }

    logger.error({ error, input }, 'Unexpected error in update item route');
    throw error;
  }
});

const removeItem = os.removeItem.handler(async ({ input, context, errors }) => {
  try {
    return await cartService.removeItem(context.identifier, input.params.itemId);
  } catch (error) {
    if (error instanceof CartNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: 'Cart not found' } });
    }

    if (error instanceof CartItemNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: 'Cart item not found' } });
    }

    logger.error({ error, input }, 'Unexpected error in remove item route');
    throw error;
  }
});

const mergeCart = os.mergeCart.handler(async ({ input, context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  try {
    return await cartService.mergeGuestCart(context.userId, input.cartToken);
  } catch (error) {
    if (error instanceof CartNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: 'Guest cart not found' } });
    }

    logger.error({ error, input }, 'Unexpected error in merge cart route');
    throw error;
  }
});

const cartOrpcRouter = os.router({
  getCart,
  addItem,
  updateItem,
  removeItem,
  mergeCart,
});

/**
 * Registers cart's oRPC routes. The onSend hook sets the guest cart token cookie once
 * `addItem` writes it to `context.request.newCartToken`.
 */
export function registerCartRoutes(fastify: FastifyInstance): void {
  fastify.register((cartScope) => {
    cartScope.addHook('onSend', (request, reply, _payload, done) => {
      const req = request as FastifyRequest & { newCartToken?: string };
      if (req.newCartToken) {
        setCartTokenCookie(reply, req.newCartToken);
      }
      done();
    });

    mountOrpcModule<CartOrpcContext>(cartScope, cartOrpcRouter, {
      prefix: '/api/cart',
      getContext: buildCartOrpcContext,
    });
  });
}
