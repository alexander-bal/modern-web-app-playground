import { ordersOrpcContract } from '@mercado/api-contracts';
import { implement } from '@orpc/server';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  OrderNotFoundError,
  OrderValidationError,
  ordersService,
} from '../services/orders.service.js';

const logger = createModuleLogger('orders');

export interface OrdersOrpcContext {
  userId?: string | undefined;
}

const os = implement(ordersOrpcContract).$context<OrdersOrpcContext>();

function isDuplicateOrderNumber(error: OrderValidationError): boolean {
  return error.message.includes('Duplicate') || error.message.includes('already exists');
}

const create = os.create.handler(async ({ input, errors }) => {
  try {
    return await ordersService.create(input);
  } catch (error) {
    if (error instanceof OrderValidationError) {
      if (isDuplicateOrderNumber(error)) {
        throw errors.CONFLICT({
          data: { error: error.message, details: error.details as string | undefined },
        });
      }
      throw errors.VALIDATION_ERROR({ data: { error: error.message, details: error.details } });
    }

    logger.error({ error, input }, 'Unexpected error in create order route');
    throw error;
  }
});

const listMyOrders = os.listMyOrders.handler(async ({ context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  const orders = await ordersService.listMyOrders(context.userId);

  return { orders };
});

const getById = os.getById.handler(async ({ input, errors }) => {
  try {
    return await ordersService.getById(input.id);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    logger.error({ error, orderId: input.id }, 'Unexpected error in get order by ID route');
    throw error;
  }
});

const list = os.list.handler(async ({ input }) => {
  const orders = await ordersService.list(input);

  return { orders };
});

const update = os.update.handler(async ({ input, errors }) => {
  const { id } = input.params;

  try {
    return await ordersService.update(id, input.body);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    if (error instanceof OrderValidationError) {
      if (isDuplicateOrderNumber(error)) {
        throw errors.CONFLICT({
          data: { error: error.message, details: error.details as string | undefined },
        });
      }
      throw errors.VALIDATION_ERROR({ data: { error: error.message, details: error.details } });
    }

    logger.error(
      { error, orderId: id, body: input.body },
      'Unexpected error in update order route'
    );
    throw error;
  }
});

const deleteOrder = os.delete.handler(async ({ input, errors }) => {
  try {
    const id = await ordersService.delete(input.id);

    return { success: true, id };
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    logger.error({ error, orderId: input.id }, 'Unexpected error in delete order route');
    throw error;
  }
});

const getByOrderNumber = os.getByOrderNumber.handler(async ({ input, context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  try {
    return await ordersService.getByOrderNumber(input.orderNumber, context.userId);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    logger.error(
      { error, orderNumber: input.orderNumber },
      'Unexpected error in get order by number route'
    );
    throw error;
  }
});

export const ordersOrpcRouter = os.router({
  create,
  listMyOrders,
  getById,
  list,
  update,
  delete: deleteOrder,
  getByOrderNumber,
});
