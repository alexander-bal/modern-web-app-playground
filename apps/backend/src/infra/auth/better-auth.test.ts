import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProduct } from '../../../tests/factories/products.js';
import { buildTestApp } from '../../app.js';
import { db, orderItems, orders, products, session, user } from '../../db/index.js';
import type { Product } from '../../modules/products/index.js';

describe('guest cart merge on sign-up/sign-in', () => {
  let fastify: FastifyInstance;
  let testProduct: Product;

  beforeEach(async () => {
    fastify = await buildTestApp();
    testProduct = await createTestProduct({ status: 'active', price: '10.00', currency: 'EUR' });
  });

  afterEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(session);
    await db.delete(user);
    await db.delete(products);
    await fastify.close();
  });

  it('merges the guest cart into the new account and clears the cart_token cookie', async () => {
    const addResponse = await fastify.inject({
      method: 'POST',
      url: '/api/cart/items',
      payload: { productId: testProduct.id, quantity: 2 },
    });
    expect(addResponse.statusCode).toBe(200);
    const cartToken = addResponse.cookies.find((c) => c.name === 'cart_token')?.value;
    expect(cartToken).toBeTruthy();

    const signUpResponse = await fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      cookies: { cart_token: cartToken as string },
      payload: {
        email: `guest-merge-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Guest Merge',
        firstName: 'Guest',
        lastName: 'Merge',
      },
    });
    expect(signUpResponse.statusCode).toBe(200);

    const clearedCartTokenCookie = signUpResponse.cookies.find((c) => c.name === 'cart_token');
    expect(clearedCartTokenCookie?.value).toBe('');

    const rawSessionCookie = signUpResponse.cookies.find(
      (c) => c.name === 'better-auth.session_token'
    )?.value;
    expect(rawSessionCookie).toBeTruthy();
    // light-my-request re-encodes whatever `cookies` is given for the next `inject()` call,
    // so this must be decoded once first or it gets encoded twice (see tests/helpers/auth.ts).
    const sessionCookie = decodeURIComponent(rawSessionCookie as string);

    const cartResponse = await fastify.inject({
      method: 'GET',
      url: '/api/cart',
      cookies: { 'better-auth.session_token': sessionCookie },
    });

    expect(cartResponse.statusCode).toBe(200);
    const cart = cartResponse.json<{ items: { productId: string; quantity: number }[] }>();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ productId: testProduct.id, quantity: 2 });
  });
});
