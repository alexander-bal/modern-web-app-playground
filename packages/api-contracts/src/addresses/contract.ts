import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  internalErrorSchema,
  notFoundErrorSchema,
  unauthorizedErrorSchema,
  unprocessableEntityErrorSchema,
} from '../shared/errors.js';
import {
  createAddressBodySchema,
  listAddressesResponseSchema,
  savedAddressSchema,
  updateAddressBodySchema,
} from './schemas.js';

const c = initContract();

export const addressesContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/addresses',
    responses: {
      200: listAddressesResponseSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    summary: 'List saved addresses',
    description: 'Returns all saved addresses for the authenticated user, ordered by default first',
  },

  create: {
    method: 'POST',
    path: '/api/v1/addresses',
    responses: {
      201: savedAddressSchema,
      401: unauthorizedErrorSchema,
      422: unprocessableEntityErrorSchema,
      500: internalErrorSchema,
    },
    body: createAddressBodySchema,
    summary: 'Create a saved address',
    description: 'Creates a new saved address for the authenticated user',
  },

  update: {
    method: 'PUT',
    path: '/api/v1/addresses/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: savedAddressSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      422: unprocessableEntityErrorSchema,
      500: internalErrorSchema,
    },
    body: updateAddressBodySchema,
    summary: 'Update a saved address',
    description:
      'Updates a saved address for the authenticated user. Setting isDefault: true triggers an atomic default swap.',
  },

  delete: {
    method: 'DELETE',
    path: '/api/v1/addresses/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      204: z.undefined(),
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    body: z.undefined(),
    summary: 'Delete a saved address',
    description: 'Deletes a saved address for the authenticated user',
  },
});
