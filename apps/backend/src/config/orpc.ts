import type { OpenAPIHandlerOptions } from '@orpc/openapi/fastify';
import type { ProcedureClientInterceptorOptions } from '@orpc/server';
import { ORPCError, onError, ValidationError } from '@orpc/server';
import type { Interceptor } from '@orpc/shared';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';

type ClientInterceptor = Interceptor<
  ProcedureClientInterceptorOptions<
    Record<never, never>,
    Record<never, never>,
    Record<never, never>
  >,
  Promise<unknown>
>;

/**
 * Remaps oRPC's built-in BAD_REQUEST input-validation failure to VALIDATION_ERROR @ 400
 * with a friendly message. Shared across every module's mount.
 */
const validationErrorInterceptor: ClientInterceptor = onError((error) => {
  if (
    error instanceof ORPCError &&
    error.code === 'BAD_REQUEST' &&
    error.cause instanceof ValidationError
  ) {
    const zodError = new z.ZodError(error.cause.issues as z.ZodIssue[]);

    throw new ORPCError('VALIDATION_ERROR', {
      status: 400,
      data: { error: fromError(zodError).toString() },
      defined: true,
    });
  }
});

/**
 * A defined error's `data` already matches the shared error-body schemas
 * (packages/api-contracts/src/shared/errors.ts), so the wire body stays flat —
 * no {code,message,data} envelope. Undefined/internal errors keep today's
 * generic message instead of leaking the raw exception.
 */
function encodeErrorResponseBody(error: ORPCError<string, unknown>): unknown {
  return error.defined ? error.data : { error: 'Internal server error' };
}

export const orpcHandlerOptions: OpenAPIHandlerOptions<Record<never, never>> = {
  clientInterceptors: [validationErrorInterceptor],
  customErrorResponseBodyEncoder: encodeErrorResponseBody,
};
