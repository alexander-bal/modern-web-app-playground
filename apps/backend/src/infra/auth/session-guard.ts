import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from './better-auth.js';

/**
 * Fastify preHandler that requires a valid Better Auth session.
 * Register only in the scope wrapping protected routes.
 */
export async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionData = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

  if (!sessionData) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const { user } = sessionData as {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isAdmin: boolean | null;
    };
  };

  request.user = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isAdmin: user.isAdmin ?? false,
    authenticated: true,
  };
}
