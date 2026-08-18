import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { auth } from './better-auth.js';

type RequestWithRawBody = FastifyRequest & { rawBody?: Buffer };

function toFetchRequest(request: FastifyRequest, baseUrl: string): Request {
  const url = new URL(request.url, baseUrl);
  const rawBody = (request as RequestWithRawBody).rawBody;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && rawBody !== undefined;

  return new Request(url, {
    method: request.method,
    headers: fromNodeHeaders(request.headers),
    ...(hasBody ? { body: rawBody } : {}),
  });
}

async function sendFetchResponse(response: Response, reply: FastifyReply): Promise<void> {
  const setCookies = response.headers.getSetCookie();

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      reply.header(key, value);
    }
  });

  if (setCookies.length > 0) {
    reply.header('set-cookie', setCookies);
  }

  reply.status(response.status);
  reply.send(Buffer.from(await response.arrayBuffer()));
}

/**
 * Mounts Better Auth's own handler at `/api/auth/*`, unprotected. Uses the raw body
 * captured by the JSON content-type parser rather than `request.body` — by the time
 * this route runs, Fastify has already fully drained the underlying request stream,
 * so a Node-stream-based bridge (`toNodeHandler`) can't read the body itself.
 */
export function mountBetterAuthHandler(fastify: FastifyInstance, baseUrl: string): void {
  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      const response = await auth.handler(toFetchRequest(request, baseUrl));
      await sendFetchResponse(response, reply);
    },
  });
}
