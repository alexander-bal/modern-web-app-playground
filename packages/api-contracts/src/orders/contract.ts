import { oc } from '@orpc/contract';
import { z } from 'zod';
import { commonErrors } from '../shared/errors.js';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderDeleteResponseSchema,
  orderIdSchema,
  orderResponseSchema,
  ordersListResponseSchema,
  orderWithItemsResponseSchema,
  updateOrderSchema,
} from './schemas.js';

const create = oc
  .route({ method: 'POST', path: '/', successStatus: 201, summary: 'Create a new order' })
  .input(createOrderSchema)
  .output(orderResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    CONFLICT: commonErrors.CONFLICT,
  });

const listMyOrders = oc
  .route({ method: 'GET', path: '/me', summary: 'List my orders' })
  .output(z.object({ orders: z.array(orderWithItemsResponseSchema) }))
  .errors({
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
  });

const getById = oc
  .route({ method: 'GET', path: '/{id}', summary: 'Get an order by ID' })
  .input(z.object({ id: orderIdSchema }))
  .output(orderResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

const list = oc
  .route({ method: 'GET', path: '/', summary: 'List all orders' })
  .input(listOrdersQuerySchema)
  .output(ordersListResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
  });

const update = oc
  .route({
    method: 'PATCH',
    path: '/{id}',
    inputStructure: 'detailed',
    summary: 'Update an order',
  })
  .input(z.object({ params: z.object({ id: orderIdSchema }), body: updateOrderSchema }))
  .output(orderResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
    CONFLICT: commonErrors.CONFLICT,
  });

const deleteOrder = oc
  .route({ method: 'DELETE', path: '/{id}', summary: 'Delete an order' })
  .input(z.object({ id: orderIdSchema }))
  .output(orderDeleteResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

const getByOrderNumber = oc
  .route({
    method: 'GET',
    path: '/by-number/{orderNumber}',
    summary: 'Get an order by order number',
  })
  .input(z.object({ orderNumber: z.string().min(1, 'Order number is required') }))
  .output(orderWithItemsResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

export const ordersOrpcContract = {
  create,
  listMyOrders,
  getById,
  list,
  update,
  delete: deleteOrder,
  getByOrderNumber,
};
