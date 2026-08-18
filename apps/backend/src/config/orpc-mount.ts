import { OpenAPIHandler } from '@orpc/openapi/fastify';
import type { AnyRouter, Context } from '@orpc/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createModuleLogger } from '../lib/logger.js';
import { orpcHandlerOptions } from './orpc.js';

const logger = createModuleLogger('orpc-mount');

export interface MountOrpcModuleOptions<T extends Context> {
  prefix: `/${string}`;
  getContext: (request: FastifyRequest, reply: FastifyReply) => T | Promise<T>;
}

/**
 * Mounts one module's oRPC router as a Fastify catch-all, inside its own child scope of
 * `fastify` — the child scope isolates each module's wildcard content-type parser from its
 * siblings (Fastify errors on a duplicate parser within one scope) while still inheriting
 * whatever hooks (e.g. authPlugin) the parent scope already has registered.
 */
export function mountOrpcModule<T extends Context>(
  fastify: FastifyInstance,
  router: AnyRouter,
  options: MountOrpcModuleOptions<T>
): void {
  fastify.register((moduleScope) => {
    const handler = new OpenAPIHandler(router, orpcHandlerOptions);

    moduleScope.addContentTypeParser('*', (_request, _payload, done) => {
      done(null, undefined);
    });

    const handleRequest = async (request: FastifyRequest, reply: FastifyReply) => {
      const { matched } = await handler.handle(request, reply, {
        prefix: options.prefix,
        context: await options.getContext(request, reply),
      });

      if (!matched) {
        reply.status(404).send({ error: 'Not found' });
      }
    };

    // Fastify's wildcard requires at least one segment after the prefix (`/api/orders/me`
    // matches `${prefix}/*`, but a bare `/api/orders` doesn't) — register the exact prefix
    // too so routes with no trailing path segment (e.g. list/create at the module root) match.
    moduleScope.all(options.prefix, handleRequest);
    moduleScope.all(`${options.prefix}/*`, handleRequest);
  });

  logger.info(`oRPC module mounted at ${options.prefix}`);
}
