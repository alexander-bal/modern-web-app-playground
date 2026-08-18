import type { Database } from '../../src/db/index.js';
import { addresses, db } from '../../src/db/index.js';
import type { Address, NewAddress } from '../../src/db/schema.js';

function buildTestAddressData(overrides: Partial<NewAddress> = {}): NewAddress {
  return {
    userId: overrides.userId ?? '00000000-0000-7000-8000-000000000001',
    fullName: overrides.fullName ?? 'Test User',
    addressLine1: overrides.addressLine1 ?? '123 Test St',
    addressLine2: overrides.addressLine2 !== undefined ? overrides.addressLine2 : null,
    city: overrides.city ?? 'Test City',
    state: overrides.state !== undefined ? overrides.state : null,
    postalCode: overrides.postalCode ?? '12345',
    countryCode: overrides.countryCode ?? 'US',
    phone: overrides.phone !== undefined ? overrides.phone : null,
    isDefault: overrides.isDefault ?? false,
  };
}

export async function createTestAddress(
  overrides: Partial<NewAddress> = {},
  database: Database = db
): Promise<Address> {
  const data = buildTestAddressData(overrides);
  const results = await database.insert(addresses).values(data).returning();
  if (!results[0]) throw new Error('Failed to create test address');
  return results[0];
}
