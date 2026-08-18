import { auth } from '../../src/infra/auth/index.js';

const SESSION_COOKIE_NAME = 'better-auth.session_token';

/**
 * Create a test user via Better Auth's own sign-up endpoint and return the signed
 * session cookie value. Hand-inserting a `session` row wouldn't work here — Better
 * Auth signs the session cookie against `BETTER_AUTH_SECRET`, so only a cookie minted
 * by Better Auth itself will pass `getSession`'s signature check.
 */
export async function createAuthenticatedUser(
  email = 'test@example.com',
  password = 'password123'
): Promise<{ userId: string; sessionToken: string }> {
  const { headers, response } = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
    },
    returnHeaders: true,
  });

  const setCookie = headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!setCookie) {
    throw new Error('Sign-up did not set a session cookie');
  }

  const rawValue = setCookie.slice(`${SESSION_COOKIE_NAME}=`.length).split(';')[0];
  if (!rawValue) {
    throw new Error('Failed to parse session cookie value');
  }

  // The Set-Cookie header carries the signed value URL-encoded. `fastify.inject`'s
  // `cookies` option re-encodes whatever it's given (via the `cookie` package's
  // `serialize`), so this must be decoded once here or the value gets encoded twice
  // and fails Better Auth's signature check.
  const sessionToken = decodeURIComponent(rawValue);

  return {
    userId: response.user.id,
    sessionToken,
  };
}
