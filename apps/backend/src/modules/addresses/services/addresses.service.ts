import type { Database } from '../../../db/index.js';
import { db } from '../../../db/index.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { CreateAddressBody, UpdateAddressBody } from '@mercado/api-contracts';
import type { AddressWithoutUserId, NewAddressEntity } from '../domain/address.entity.js';
import {
  clearDefaultForUser,
  countAddressesByUserId,
  deleteAddressById,
  findAddressesByUserId,
  findAddressByIdAndUserId,
  insertAddress,
  updateAddressById,
} from '../repositories/addresses.repository.js';

const logger = createModuleLogger('addresses');

const ADDRESS_LIMIT = 20;

export class AddressNotFoundError extends Error {
  constructor() {
    super('Address not found');
    this.name = 'AddressNotFoundError';
  }
}

export class AddressLimitError extends Error {
  constructor() {
    super('Address limit reached');
    this.name = 'AddressLimitError';
  }
}

function toPublic(address: {
  id: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
}): AddressWithoutUserId {
  return {
    id: address.id,
    fullName: address.fullName,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    phone: address.phone,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

export async function listAddressesService(
  userId: string,
  database: Database = db
): Promise<AddressWithoutUserId[]> {
  const rows = await findAddressesByUserId(userId, database);
  return rows.map(toPublic);
}

export async function createAddressService(
  userId: string,
  body: CreateAddressBody,
  database: Database = db
): Promise<AddressWithoutUserId> {
  const count = await countAddressesByUserId(userId, database);
  if (count >= ADDRESS_LIMIT) {
    throw new AddressLimitError();
  }

  const isFirstAddress = count === 0;
  const makeDefault = isFirstAddress || body.isDefault === true;

  if (makeDefault) {
    // Atomic: clear existing default then insert with is_default=true
    return database.transaction(async (tx) => {
      await clearDefaultForUser(userId, tx as unknown as Database);
      const address = await insertAddress(
        {
          userId,
          fullName: body.fullName,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2 ?? null,
          city: body.city,
          state: body.state ?? null,
          postalCode: body.postalCode,
          countryCode: body.countryCode,
          phone: body.phone ?? null,
          isDefault: true,
        },
        tx as unknown as Database
      );
      logger.info({ addressId: address.id, userId }, 'Address created (default)');
      return toPublic(address);
    });
  }

  const address = await insertAddress(
    {
      userId,
      fullName: body.fullName,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2 ?? null,
      city: body.city,
      state: body.state ?? null,
      postalCode: body.postalCode,
      countryCode: body.countryCode,
      phone: body.phone ?? null,
      isDefault: false,
    },
    database
  );
  logger.info({ addressId: address.id, userId }, 'Address created');
  return toPublic(address);
}

function buildUpdateData(body: UpdateAddressBody): Partial<Omit<NewAddressEntity, 'userId'>> {
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

export async function updateAddressService(
  id: string,
  userId: string,
  body: UpdateAddressBody,
  database: Database = db
): Promise<AddressWithoutUserId> {
  const existing = await findAddressByIdAndUserId(id, userId, database);
  if (!existing) {
    throw new AddressNotFoundError();
  }

  if (body.isDefault === true) {
    // Atomic default swap in a transaction
    return database.transaction(async (tx) => {
      await clearDefaultForUser(userId, tx as unknown as Database);
      const updated = await updateAddressById(
        id,
        userId,
        buildUpdateData({ ...body, isDefault: true }),
        tx as unknown as Database
      );
      if (!updated) throw new AddressNotFoundError();
      logger.info({ addressId: id, userId }, 'Address set as default');
      return toPublic(updated);
    });
  }

  const updated = await updateAddressById(id, userId, buildUpdateData(body), database);
  if (!updated) throw new AddressNotFoundError();
  logger.info({ addressId: id, userId }, 'Address updated');
  return toPublic(updated);
}

export async function deleteAddressService(
  id: string,
  userId: string,
  database: Database = db
): Promise<void> {
  const deleted = await deleteAddressById(id, userId, database);
  if (!deleted) {
    throw new AddressNotFoundError();
  }
  logger.info({ addressId: id, userId }, 'Address deleted');
}

export const addressesService = {
  list: (userId: string) => listAddressesService(userId),
  create: (userId: string, body: CreateAddressBody) => createAddressService(userId, body),
  update: (id: string, userId: string, body: UpdateAddressBody) =>
    updateAddressService(id, userId, body),
  delete: (id: string, userId: string) => deleteAddressService(id, userId),
};
