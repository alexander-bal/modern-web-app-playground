import { oc } from '@orpc/contract';
import { commonErrors } from '../shared/errors.js';
import { checkoutRequestSchema, checkoutResponseSchema } from './schemas.js';

const checkout = oc
  .route({
    method: 'POST',
    path: '/',
    summary: 'Place order from current cart',
    description:
      'Converts the authenticated user cart into a confirmed order with shipping and billing addresses',
  })
  .input(checkoutRequestSchema)
  .output(checkoutResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
    UNPROCESSABLE_ENTITY: commonErrors.UNPROCESSABLE_ENTITY,
  });

export const checkoutOrpcContract = { checkout };
