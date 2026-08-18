import { createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { env } from '../../lib/env.js';
import { createModuleLogger } from '../../lib/logger.js';
import { mergeGuestCart } from '../../modules/cart/index.js';

const logger = createModuleLogger('better-auth');

const CART_TOKEN_COOKIE_NAME = 'cart_token';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_APP_URL],
  // Postgres generates the `id` for every table via `gen_random_uuid()` (this repo's
  // convention) — without this, Better Auth generates its own non-UUID id strings that
  // fail to insert into a uuid column.
  advanced: {
    database: {
      generateId: false,
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },

  emailVerification: {
    sendVerificationEmail: ({ user, url }) => {
      // No email-sending infra exists in this repo yet. This logs the link so the
      // flow is exercisable in dev; replace with a real provider before relying on
      // this in production.
      logger.warn(
        { userId: user.id, url },
        'STUB sendVerificationEmail — no email provider wired up'
      );
      return Promise.resolve();
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },

  session: {
    expiresIn: env.SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  },

  user: {
    additionalFields: {
      firstName: { type: 'string', required: true, input: true },
      lastName: { type: 'string', required: true, input: true },
      isAdmin: { type: 'boolean', required: false, defaultValue: false, input: false },
      adminRole: { type: 'string', required: false, input: false },
      adminCompanyIds: { type: 'string[]', required: false, input: false },
      phone: { type: 'string', required: false, input: true },
      locale: { type: 'string', required: false, defaultValue: 'en-GB', input: true },
      config: { type: 'json', required: false, input: false },
      isOptedInToMarketing: { type: 'boolean', required: false, defaultValue: false, input: true },
      plainCustomerId: { type: 'string', required: false, input: false },
      plainLastSyncedAt: { type: 'date', required: false, input: false },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email' && ctx.path !== '/sign-up/email') {
        return;
      }

      const newSession = ctx.context.newSession;
      if (!newSession) {
        return;
      }

      const cartToken = ctx.getCookie(CART_TOKEN_COOKIE_NAME);
      if (!cartToken) {
        return;
      }

      try {
        await mergeGuestCart(newSession.user.id, cartToken);
        ctx.setCookie(CART_TOKEN_COOKIE_NAME, '', { maxAge: 0, path: '/' });
        logger.info({ userId: newSession.user.id }, 'Guest cart merged on auth');
      } catch (error) {
        // Runs after the session has already committed, so a failure here can't roll back sign-in.
        logger.warn(
          { userId: newSession.user.id, cartToken, error },
          'Guest cart merge failed post-login'
        );
      }
    }),
  },
});
