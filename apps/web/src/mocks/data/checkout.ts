import type { Address, CheckoutResponse } from '@mercado/api-contracts';
import { makeCartItem } from './cart.js';

export function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    fullName: 'Jane Doe',
    addressLine1: '123 Main St',
    addressLine2: undefined,
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    countryCode: 'US',
    phone: undefined,
    ...overrides,
  };
}

export function makeCheckoutResponse(overrides: Partial<CheckoutResponse> = {}): CheckoutResponse {
  const items = overrides.items ?? [makeCartItem()];
  return {
    id: crypto.randomUUID(),
    orderNumber: 'ORD-1001',
    status: 'confirmed',
    orderDate: '2024-01-01T00:00:00.000Z',
    currency: 'USD',
    subtotal: '19.99',
    taxAmount: '0.00',
    discountAmount: '0.00',
    shippingAmount: '0.00',
    totalAmount: '19.99',
    shippingAddress: makeAddress(),
    billingAddress: makeAddress(),
    items,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
