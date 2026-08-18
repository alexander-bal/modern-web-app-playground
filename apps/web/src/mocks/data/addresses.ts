import type { SavedAddress } from '@mercado/api-contracts';

export function makeSavedAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: crypto.randomUUID(),
    fullName: 'Jane Doe',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    countryCode: 'US',
    phone: null,
    isDefault: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
