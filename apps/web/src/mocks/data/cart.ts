import type { CartItem, CartResponse } from '@mercado/api-contracts';

export function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: crypto.randomUUID(),
    productId: crypto.randomUUID(),
    productName: 'Wireless Mouse',
    productSku: 'WM-001',
    productImageUrl: null,
    unitPrice: '19.99',
    quantity: 1,
    lineTotal: '19.99',
    currency: 'USD',
    ...overrides,
  };
}

export function makeCart(overrides: Partial<CartResponse> = {}): CartResponse {
  const items = overrides.items ?? [makeCartItem()];
  const subtotal = items
    .reduce((sum, item) => sum + Number.parseFloat(item.lineTotal), 0)
    .toFixed(2);
  return {
    items,
    subtotal,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    currency: items[0]?.currency ?? 'USD',
    ...overrides,
  };
}

export function makeEmptyCart(): CartResponse {
  return makeCart({ items: [], subtotal: '0.00', itemCount: 0 });
}
