import { oc } from '@orpc/contract';
import { z } from 'zod';
import { commonErrors } from '../shared/errors.js';
import {
  createAddressBodySchema,
  listAddressesResponseSchema,
  savedAddressSchema,
  updateAddressBodySchema,
} from './schemas.js';

const list = oc
  .route({ method: 'GET', path: '/', summary: 'List saved addresses' })
  .output(listAddressesResponseSchema)
  .errors({
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
  });

const create = oc
  .route({ method: 'POST', path: '/', successStatus: 201, summary: 'Create a saved address' })
  .input(createAddressBodySchema)
  .output(savedAddressSchema)
  .errors({
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    UNPROCESSABLE_ENTITY: commonErrors.UNPROCESSABLE_ENTITY,
  });

const update = oc
  .route({
    method: 'PUT',
    path: '/{id}',
    inputStructure: 'detailed',
    summary: 'Update a saved address',
  })
  .input(z.object({ params: z.object({ id: z.uuid() }), body: updateAddressBodySchema }))
  .output(savedAddressSchema)
  .errors({
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
    UNPROCESSABLE_ENTITY: commonErrors.UNPROCESSABLE_ENTITY,
  });

const deleteAddress = oc
  .route({
    method: 'DELETE',
    path: '/{id}',
    successStatus: 204,
    inputStructure: 'detailed',
    summary: 'Delete a saved address',
  })
  .input(z.object({ params: z.object({ id: z.uuid() }) }))
  .output(z.undefined())
  .errors({
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

export const addressesOrpcContract = {
  list,
  create,
  update,
  delete: deleteAddress,
};
