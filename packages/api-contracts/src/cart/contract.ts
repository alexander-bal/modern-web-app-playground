import { oc } from '@orpc/contract';
import { z } from 'zod';
import { commonErrors } from '../shared/errors.js';
import { addItemSchema, cartResponseSchema, mergeCartSchema, updateItemSchema } from './schemas.js';

const getCart = oc
  .route({ method: 'GET', path: '/', summary: 'Get current cart' })
  .output(cartResponseSchema);

const addItem = oc
  .route({ method: 'POST', path: '/items', summary: 'Add item to cart' })
  .input(addItemSchema)
  .output(cartResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    NOT_FOUND: commonErrors.NOT_FOUND,
    UNPROCESSABLE_ENTITY: commonErrors.UNPROCESSABLE_ENTITY,
  });

const updateItem = oc
  .route({
    method: 'PATCH',
    path: '/items/{itemId}',
    inputStructure: 'detailed',
    summary: 'Update item quantity',
  })
  .input(
    z.object({
      params: z.object({ itemId: z.uuid('Invalid item ID') }),
      body: updateItemSchema,
    })
  )
  .output(cartResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

const removeItem = oc
  .route({
    method: 'DELETE',
    path: '/items/{itemId}',
    inputStructure: 'detailed',
    summary: 'Remove item from cart',
  })
  .input(z.object({ params: z.object({ itemId: z.uuid('Invalid item ID') }) }))
  .output(cartResponseSchema)
  .errors({
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

const mergeCart = oc
  .route({ method: 'POST', path: '/merge', summary: 'Merge guest cart' })
  .input(mergeCartSchema)
  .output(cartResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

export const cartOrpcContract = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  mergeCart,
};
