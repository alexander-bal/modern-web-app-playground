import { http } from 'msw';
import { mockJson } from './build-handler.js';
import { makeSavedAddress } from './data/addresses.js';
import { makeUser } from './data/auth.js';
import { makeCart } from './data/cart.js';
import { makeCheckoutResponse } from './data/checkout.js';
import { makeOrder } from './data/orders.js';

/** Happy-path defaults for the checkout flow; tests override individual endpoints via mswControl. */
export const handlers = [
  http.get('/api/auth/me', () => mockJson(makeUser())),
  http.get('/api/cart', () => mockJson(makeCart())),
  http.get('/api/v1/addresses', () =>
    mockJson({ addresses: [makeSavedAddress({ isDefault: true })] })
  ),
  http.post('/api/checkout', () => mockJson(makeCheckoutResponse())),
  http.get('/api/orders/by-number/:orderNumber', ({ params }) =>
    mockJson(makeOrder({ orderNumber: String(params.orderNumber) }))
  ),
];
