import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAuthenticatedUser } from '../../../tests/helpers/auth.js';
import { buildTestApp } from '../../app.js';
import { db, session, user } from '../../db/index.js';

const SESSION_COOKIE_NAME = 'better-auth.session_token';

const UNAUTHENTICATED_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Authentication required',
};

describe('session guard', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    await db.delete(session);
    await db.delete(user);
    await fastify.close();
  });

  it('rejects a protected request with no session cookie', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/orders' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(UNAUTHENTICATED_BODY);
  });

  it('rejects a protected request with an invalid session cookie', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders',
      cookies: { [SESSION_COOKIE_NAME]: 'not-a-real-session-token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(UNAUTHENTICATED_BODY);
  });

  it('allows a protected request with a valid session cookie', async () => {
    const { sessionToken } = await createAuthenticatedUser('session-guard@example.com');

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders',
      cookies: { [SESSION_COOKIE_NAME]: sessionToken },
    });

    expect(response.statusCode).toBe(200);
  });

  it('public routes are unaffected by the guard', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/products' });

    expect(response.statusCode).toBe(200);
  });
});
