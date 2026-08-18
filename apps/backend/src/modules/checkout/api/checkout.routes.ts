import { checkoutOrpcContract } from '@mercado/api-contracts';
import { implement } from '@orpc/server';
import type { FastifyRequest } from 'fastify';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  CartNotFoundError,
  CheckoutAddressNotFoundError,
  checkoutService,
  EmptyCartError,
  InactiveProductError,
  OrderNotCheckoutEligibleError,
} from '../services/checkout.service.js';

const logger = createModuleLogger('checkout');

const CART_TOKEN_COOKIE_NAME = 'cart_token';

export interface CheckoutOrpcContext {
  userId?: string | undefined;
  cartToken?: string | undefined;
}

export function buildCheckoutOrpcContext(request: FastifyRequest): CheckoutOrpcContext {
  return {
    userId: request.user?.id,
    cartToken: request.cookies[CART_TOKEN_COOKIE_NAME],
  };
}

const os = implement(checkoutOrpcContract).$context<CheckoutOrpcContext>();

const checkout = os.checkout.handler(async ({ input, context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({
      data: { error: 'Authentication required. Please log in to place an order.' },
    });
  }

  try {
    return await checkoutService.checkout(context.userId, input, context.cartToken);
  } catch (error) {
    if (error instanceof CartNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    if (
      error instanceof EmptyCartError ||
      error instanceof InactiveProductError ||
      error instanceof OrderNotCheckoutEligibleError ||
      error instanceof CheckoutAddressNotFoundError
    ) {
      throw errors.UNPROCESSABLE_ENTITY({ data: { error: error.message } });
    }

    logger.error(
      { error, body: input, userId: context.userId },
      'Unexpected error in checkout route'
    );
    throw error;
  }
});

export const checkoutOrpcRouter = os.router({ checkout });
