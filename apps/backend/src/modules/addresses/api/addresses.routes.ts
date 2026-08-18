import { addressesOrpcContract } from '@mercado/api-contracts';
import { implement } from '@orpc/server';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  AddressLimitError,
  AddressNotFoundError,
  addressesService,
} from '../services/addresses.service.js';

const logger = createModuleLogger('addresses');

export interface AddressesOrpcContext {
  userId?: string | undefined;
}

const os = implement(addressesOrpcContract).$context<AddressesOrpcContext>();

const list = os.list.handler(async ({ context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  try {
    const addresses = await addressesService.list(context.userId);
    return { addresses };
  } catch (error) {
    logger.error({ error, userId: context.userId }, 'Unexpected error in list addresses');
    throw error;
  }
});

const create = os.create.handler(async ({ input, context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  try {
    return await addressesService.create(context.userId, input);
  } catch (error) {
    if (error instanceof AddressLimitError) {
      throw errors.UNPROCESSABLE_ENTITY({ data: { error: error.message } });
    }

    logger.error({ error, userId: context.userId }, 'Unexpected error in create address');
    throw error;
  }
});

const update = os.update.handler(async ({ input, context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  try {
    return await addressesService.update(input.params.id, context.userId, input.body);
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    logger.error(
      { error, addressId: input.params.id, userId: context.userId },
      'Unexpected error in update address'
    );
    throw error;
  }
});

const deleteAddress = os.delete.handler(async ({ input, context, errors }) => {
  if (!context.userId) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  try {
    await addressesService.delete(input.params.id, context.userId);
    return undefined;
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    logger.error(
      { error, addressId: input.params.id, userId: context.userId },
      'Unexpected error in delete address'
    );
    throw error;
  }
});

export const addressesOrpcRouter = os.router({
  list,
  create,
  update,
  delete: deleteAddress,
});
