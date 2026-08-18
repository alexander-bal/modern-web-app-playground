import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestAddress } from '../../../../tests/factories/addresses.js';
import { createAuthenticatedUser } from '../../../../tests/helpers/auth.js';
import { buildTestApp } from '../../../app.js';
import { addresses, db, sessions, users } from '../../../db/index.js';
import { addressesService } from '../services/addresses.service.js';

const ADDRESS_LIMIT = 20;
const UNKNOWN_ADDRESS_ID = '00000000-0000-0000-0000-0000000000ff';

// The auth preHandler rejects before the route handler runs, so callers never see the
// handler's own `Authentication required` shape.
const UNAUTHENTICATED_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Authentication required',
};

const validBody = {
  fullName: 'Jane Doe',
  addressLine1: '123 Main St',
  city: 'New York',
  postalCode: '10001',
  countryCode: 'US',
};

describe('Addresses Routes', () => {
  let fastify: FastifyInstance;
  let userId: string;
  let sessionToken: string;

  beforeEach(async () => {
    fastify = await buildTestApp();
    const auth = await createAuthenticatedUser('addresses@example.com', 'password123', db);
    userId = auth.userId;
    sessionToken = auth.sessionToken;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(addresses);
    await db.delete(sessions);
    await db.delete(users);
    await fastify.close();
  });

  describe('GET /api/v1/addresses', () => {
    it('rejects an unauthenticated request without reading addresses', async () => {
      const listSpy = vi.spyOn(addressesService, 'list');

      const response = await fastify.inject({ method: 'GET', url: '/api/v1/addresses' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual(UNAUTHENTICATED_BODY);
      expect(listSpy).not.toHaveBeenCalled();
    });

    it("returns only the authenticated user's addresses", async () => {
      const other = await createAuthenticatedUser('other@example.com', 'password123', db);
      await createTestAddress({ userId, fullName: 'Mine' });
      await createTestAddress({ userId: other.userId, fullName: 'Theirs' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/addresses',
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ addresses: { fullName: string }[] }>();
      expect(body.addresses.map((a) => a.fullName)).toEqual(['Mine']);
    });

    it('reports a service failure as 500 rather than surfacing the error', async () => {
      vi.spyOn(addressesService, 'list').mockRejectedValue(new Error('connection lost'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/addresses',
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'Internal server error' });
      expect(response.body).not.toContain('connection lost');
    });
  });

  describe('POST /api/v1/addresses', () => {
    it('rejects an unauthenticated request without persisting an address', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        payload: validBody,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual(UNAUTHENTICATED_BODY);
      expect(await db.select().from(addresses)).toHaveLength(0);
    });

    it('persists the address and returns it as 201', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        cookies: { sid: sessionToken },
        payload: { ...validBody, fullName: 'Persisted Person' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ fullName: 'Persisted Person', city: 'New York' });

      const stored = await db.select().from(addresses);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ fullName: 'Persisted Person', userId });
    });

    it(`returns 422 once the user already holds ${ADDRESS_LIMIT} addresses`, async () => {
      for (let i = 0; i < ADDRESS_LIMIT; i++) {
        await createTestAddress({ userId, fullName: `Address ${i}` });
      }

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        cookies: { sid: sessionToken },
        payload: validBody,
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({ error: 'Address limit reached' });
      expect(await db.select().from(addresses)).toHaveLength(ADDRESS_LIMIT);
    });

    it('reports a service failure as 500 rather than surfacing the error', async () => {
      vi.spyOn(addressesService, 'create').mockRejectedValue(new Error('disk full'));

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        cookies: { sid: sessionToken },
        payload: validBody,
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'Internal server error' });
      expect(response.body).not.toContain('disk full');
    });
  });

  describe('PUT /api/v1/addresses/:id', () => {
    it('rejects an unauthenticated request without mutating the address', async () => {
      const address = await createTestAddress({ userId, city: 'Untouched City' });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v1/addresses/${address.id}`,
        payload: { city: 'Changed City' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual(UNAUTHENTICATED_BODY);
      const [stored] = await db.select().from(addresses);
      expect(stored?.city).toBe('Untouched City');
    });

    it('applies the update and returns the stored address', async () => {
      const address = await createTestAddress({ userId, city: 'Old City' });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v1/addresses/${address.id}`,
        cookies: { sid: sessionToken },
        payload: { city: 'New City' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: address.id, city: 'New City' });
      const [stored] = await db.select().from(addresses);
      expect(stored?.city).toBe('New City');
    });

    it('returns 404 for an address the user does not own', async () => {
      const other = await createAuthenticatedUser('stranger@example.com', 'password123', db);
      const foreign = await createTestAddress({ userId: other.userId, city: 'Their City' });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v1/addresses/${foreign.id}`,
        cookies: { sid: sessionToken },
        payload: { city: 'Hijacked City' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'Address not found' });
      const [stored] = await db.select().from(addresses);
      expect(stored?.city).toBe('Their City');
    });

    it('reports a service failure as 500 rather than surfacing the error', async () => {
      const address = await createTestAddress({ userId });
      vi.spyOn(addressesService, 'update').mockRejectedValue(new Error('deadlock detected'));

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v1/addresses/${address.id}`,
        cookies: { sid: sessionToken },
        payload: { city: 'New City' },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'Internal server error' });
      expect(response.body).not.toContain('deadlock detected');
    });
  });

  describe('DELETE /api/v1/addresses/:id', () => {
    it('rejects an unauthenticated request without deleting the address', async () => {
      const address = await createTestAddress({ userId });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/addresses/${address.id}`,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual(UNAUTHENTICATED_BODY);
      expect(await db.select().from(addresses)).toHaveLength(1);
    });

    it('deletes the address and returns 204 with no body', async () => {
      const address = await createTestAddress({ userId });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/addresses/${address.id}`,
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(await db.select().from(addresses)).toHaveLength(0);
    });

    it('returns 404 for an address that does not exist', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/addresses/${UNKNOWN_ADDRESS_ID}`,
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'Address not found' });
    });

    it('reports a service failure as 500 rather than surfacing the error', async () => {
      const address = await createTestAddress({ userId });
      vi.spyOn(addressesService, 'delete').mockRejectedValue(new Error('replica lag'));

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/addresses/${address.id}`,
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'Internal server error' });
      expect(response.body).not.toContain('replica lag');
      expect(await db.select().from(addresses)).toHaveLength(1);
    });
  });
});
