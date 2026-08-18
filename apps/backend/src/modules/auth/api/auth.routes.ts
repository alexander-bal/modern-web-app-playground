import { authOrpcContract } from '@mercado/api-contracts';
import { implement } from '@orpc/server';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../../lib/env.js';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  authService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionNotFoundError,
  UserNotFoundError,
} from '../services/auth.service.js';

const logger = createModuleLogger('auth');

const SESSION_COOKIE_NAME = 'sid';
const CART_TOKEN_COOKIE_NAME = 'cart_token';

function getSessionMaxAge(): number {
  return env.SESSION_EXPIRY_DAYS * 24 * 60 * 60;
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: getSessionMaxAge(),
  });
}

export interface AuthOrpcContext {
  request: FastifyRequest;
  reply: FastifyReply;
}

const os = implement(authOrpcContract).$context<AuthOrpcContext>();

const register = os.register.handler(async ({ input, context, errors }) => {
  try {
    const { user, sessionToken } = await authService.register(input);
    setSessionCookie(context.reply, sessionToken);

    logger.info({ userId: user.id }, 'Registration successful');

    return user;
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      throw errors.CONFLICT({ data: { error: error.message } });
    }

    logger.error({ error, body: { email: input.email } }, 'Unexpected error in register route');
    throw error;
  }
});

const login = os.login.handler(async ({ input, context, errors }) => {
  try {
    const cartToken = context.request.cookies[CART_TOKEN_COOKIE_NAME];
    const { user, sessionToken, cartMerged } = await authService.login(input, cartToken);

    setSessionCookie(context.reply, sessionToken);
    if (cartMerged && cartToken) {
      context.reply.clearCookie(CART_TOKEN_COOKIE_NAME, { path: '/' });
    }

    logger.info({ userId: user.id, cartMerged }, 'Login successful');

    return user;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      throw errors.UNAUTHORIZED({ data: { error: error.message } });
    }

    logger.error({ error, body: { email: input.email } }, 'Unexpected error in login route');
    throw error;
  }
});

const logout = os.logout.handler(async ({ context }) => {
  try {
    const token = context.request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await authService.logout(token);
    }

    context.reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    return { success: true };
  } catch (error) {
    logger.error({ error }, 'Unexpected error in logout route');
    throw error;
  }
});

// Validates the session cookie manually — auth routes are registered in the unprotected
// scope, so no authPlugin hook runs before this handler.
const me = os.me.handler(async ({ context, errors }) => {
  const sessionToken = context.request.cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
  }

  let userId: string;
  try {
    const sessionUser = await authService.validateSession(sessionToken);
    userId = sessionUser.id;
  } catch (error) {
    if (error instanceof SessionNotFoundError || error instanceof SessionExpiredError) {
      throw errors.UNAUTHORIZED({ data: { error: 'Authentication required' } });
    }

    logger.error({ error }, 'Unexpected error in me route');
    throw error;
  }

  try {
    return await authService.getMe(userId);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      throw errors.UNAUTHORIZED({ data: { error: 'User not found' } });
    }

    logger.error({ error }, 'Unexpected error in me route');
    throw error;
  }
});

export const authOrpcRouter = os.router({
  register,
  login,
  logout,
  me,
});
