import { addressesContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import { tsRestRouterOptions } from '../../../config/server.js';
import type { FastifyInstance } from 'fastify';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  AddressLimitError,
  AddressNotFoundError,
  addressesService,
} from '../services/addresses.service.js';

const logger = createModuleLogger('addresses');

const s = initServer();

const router = s.router(addressesContract, {
  list: async ({ request }) => {
    try {
      if (!request.user) {
        return { status: 401 as const, body: { error: 'Authentication required' } };
      }
      const addresses = await addressesService.list(request.user.id);
      return { status: 200 as const, body: { addresses } };
    } catch (error) {
      logger.error({ error, userId: request.user?.id }, 'Unexpected error in list addresses');
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },

  create: async ({ request, body }) => {
    try {
      if (!request.user) {
        return { status: 401 as const, body: { error: 'Authentication required' } };
      }
      const address = await addressesService.create(request.user.id, body);
      return { status: 201 as const, body: address };
    } catch (error) {
      if (error instanceof AddressLimitError) {
        return { status: 422 as const, body: { error: error.message } };
      }
      logger.error({ error, userId: request.user?.id }, 'Unexpected error in create address');
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },

  update: async ({ request, params, body }) => {
    try {
      if (!request.user) {
        return { status: 401 as const, body: { error: 'Authentication required' } };
      }
      const address = await addressesService.update(params.id, request.user.id, body);
      return { status: 200 as const, body: address };
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        return { status: 404 as const, body: { error: error.message } };
      }
      logger.error(
        { error, addressId: params.id, userId: request.user?.id },
        'Unexpected error in update address'
      );
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },

  delete: async ({ request, params }) => {
    try {
      if (!request.user) {
        return { status: 401 as const, body: { error: 'Authentication required' } };
      }
      await addressesService.delete(params.id, request.user.id);
      return { status: 204 as const, body: undefined };
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        return { status: 404 as const, body: { error: error.message } };
      }
      logger.error(
        { error, addressId: params.id, userId: request.user?.id },
        'Unexpected error in delete address'
      );
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },
});

export function registerAddressesRoutes(fastify: FastifyInstance) {
  return s.registerRouter(addressesContract, router, fastify, tsRestRouterOptions);
}
