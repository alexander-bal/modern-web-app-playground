import type { OrderWithItemsResponse } from '@mercado/api-contracts';
import { makeCartItem } from './cart.js';
import { makeAddress } from './checkout.js';

/** Orders serialize shippingAddress/billingAddress as JSON strings — see parseAddress in src/lib/parse-address.ts. */
export function makeOrder(overrides: Partial<OrderWithItemsResponse> = {}): OrderWithItemsResponse {
  const items = overrides.items ?? [makeCartItem()];
  return {
    id: crypto.randomUUID(),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    status: 'confirmed',
    orderNumber: 'ORD-1001',
    referenceNumber: null,
    orderDate: '2024-01-01T00:00:00.000Z',
    expectedDeliveryDate: null,
    currency: 'USD',
    subtotal: '19.99',
    taxAmount: '0.00',
    discountAmount: '0.00',
    shippingAmount: '0.00',
    totalAmount: '19.99',
    shippingAddress: JSON.stringify(makeAddress()),
    billingAddress: JSON.stringify(makeAddress()),
    paymentTerms: null,
    paymentTransactionId: null,
    notes: null,
    customerNotes: null,
    items,
    ...overrides,
  };
}
