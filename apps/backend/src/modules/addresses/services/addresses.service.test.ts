import { afterEach, describe, expect, it } from 'vitest';
import { createTestUser } from '../../../../tests/factories/users.js';
import { createTestAddress } from '../../../../tests/factories/addresses.js';
import { addresses, db, users } from '../../../db/index.js';
import {
  AddressLimitError,
  AddressNotFoundError,
  createAddressService,
  deleteAddressService,
  listAddressesService,
  updateAddressService,
} from './addresses.service.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000010';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000011';

const baseAddress = {
  fullName: 'Jane Doe',
  addressLine1: '123 Main St',
  city: 'New York',
  postalCode: '10001',
  countryCode: 'US',
};

afterEach(async () => {
  await db.delete(addresses);
  await db.delete(users);
});

describe('listAddressesService', () => {
  it('returns empty array when user has no addresses', async () => {
    const result = await listAddressesService(TEST_USER_ID);
    expect(result).toEqual([]);
  });

  it('orders default address first, then by createdAt asc', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const addr1 = await createTestAddress({
      userId: TEST_USER_ID,
      fullName: 'First',
      isDefault: false,
    });
    const addr2 = await createTestAddress({
      userId: TEST_USER_ID,
      fullName: 'Second',
      isDefault: true,
    });
    const result = await listAddressesService(TEST_USER_ID);
    expect(result[0]?.id).toBe(addr2.id);
    expect(result[1]?.id).toBe(addr1.id);
  });
});

describe('createAddressService', () => {
  it('first address becomes default automatically', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const address = await createAddressService(TEST_USER_ID, { ...baseAddress });
    expect(address.isDefault).toBe(true);
  });

  it('explicit isDefault: true sets address as default and clears previous', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const first = await createAddressService(TEST_USER_ID, { ...baseAddress });
    expect(first.isDefault).toBe(true);

    const second = await createAddressService(TEST_USER_ID, {
      ...baseAddress,
      fullName: 'Second',
      isDefault: true,
    });
    expect(second.isDefault).toBe(true);

    const list = await listAddressesService(TEST_USER_ID);
    const updatedFirst = list.find((a) => a.id === first.id);
    expect(updatedFirst?.isDefault).toBe(false);
  });

  it('second address without isDefault is not default', async () => {
    await createTestUser({ id: TEST_USER_ID });
    await createAddressService(TEST_USER_ID, { ...baseAddress });
    const second = await createAddressService(TEST_USER_ID, {
      ...baseAddress,
      fullName: 'Second',
    });
    expect(second.isDefault).toBe(false);
  });

  it('rejects creation when user already has 20 addresses', async () => {
    await createTestUser({ id: TEST_USER_ID });
    for (let i = 0; i < 20; i++) {
      await createTestAddress({ userId: TEST_USER_ID, fullName: `Address ${i}` });
    }
    await expect(createAddressService(TEST_USER_ID, { ...baseAddress })).rejects.toThrow(
      AddressLimitError
    );
  });

  it('does not include userId in returned object', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const address = await createAddressService(TEST_USER_ID, { ...baseAddress });
    expect(address).not.toHaveProperty('userId');
  });
});

describe('updateAddressService', () => {
  it('updates address fields', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const addr = await createTestAddress({ userId: TEST_USER_ID, fullName: 'Old Name' });
    const updated = await updateAddressService(addr.id, TEST_USER_ID, { fullName: 'New Name' });
    expect(updated.fullName).toBe('New Name');
  });

  it('set-default atomically swaps default', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const first = await createTestAddress({ userId: TEST_USER_ID, isDefault: true });
    const second = await createTestAddress({ userId: TEST_USER_ID, isDefault: false });

    await updateAddressService(second.id, TEST_USER_ID, { isDefault: true });

    const list = await listAddressesService(TEST_USER_ID);
    const updatedFirst = list.find((a) => a.id === first.id);
    const updatedSecond = list.find((a) => a.id === second.id);
    expect(updatedFirst?.isDefault).toBe(false);
    expect(updatedSecond?.isDefault).toBe(true);
  });

  it('throws AddressNotFoundError for another user address', async () => {
    await createTestUser({ id: TEST_USER_ID });
    await createTestUser({ id: OTHER_USER_ID });
    const addr = await createTestAddress({ userId: OTHER_USER_ID });
    await expect(
      updateAddressService(addr.id, TEST_USER_ID, { fullName: 'Hacked' })
    ).rejects.toThrow(AddressNotFoundError);
  });
});

describe('deleteAddressService', () => {
  it('deletes an address', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const addr = await createTestAddress({ userId: TEST_USER_ID });
    await deleteAddressService(addr.id, TEST_USER_ID);
    const list = await listAddressesService(TEST_USER_ID);
    expect(list).toHaveLength(0);
  });

  it('does not auto-assign a new default when default address is deleted', async () => {
    await createTestUser({ id: TEST_USER_ID });
    const defaultAddr = await createTestAddress({ userId: TEST_USER_ID, isDefault: true });
    await createTestAddress({ userId: TEST_USER_ID, isDefault: false });
    await deleteAddressService(defaultAddr.id, TEST_USER_ID);
    const list = await listAddressesService(TEST_USER_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.isDefault).toBe(false);
  });

  it('throws AddressNotFoundError for another user address', async () => {
    await createTestUser({ id: TEST_USER_ID });
    await createTestUser({ id: OTHER_USER_ID });
    const addr = await createTestAddress({ userId: OTHER_USER_ID });
    await expect(deleteAddressService(addr.id, TEST_USER_ID)).rejects.toThrow(AddressNotFoundError);
  });
});
