import { z } from 'zod';

export const validationErrorSchema = z.object({
  error: z.string(),
  details: z
    .union([z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))])
    .optional(),
});

export const notFoundErrorSchema = z.object({
  error: z.string(),
});

export const unauthorizedErrorSchema = z.object({
  error: z.string(),
});

export const internalErrorSchema = z.object({
  error: z.string(),
});

export const conflictErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

export const unprocessableEntityErrorSchema = z.object({
  error: z.string(),
});

/**
 * Named oRPC errors, reused across modules via `.errors(pick(commonErrors, [...]))`.
 * Each `data` schema matches this API's flat `{error, details?}` response body shape,
 * so the wire body is unchanged for consumers. 500 stays implicit (oRPC's default for
 * unhandled throws) and isn't declared here.
 */
export const commonErrors = {
  VALIDATION_ERROR: {
    status: 400,
    message: 'Validation failed',
    data: validationErrorSchema,
  },
  UNAUTHORIZED: {
    status: 401,
    message: 'Authentication required',
    data: unauthorizedErrorSchema,
  },
  NOT_FOUND: {
    status: 404,
    message: 'Not found',
    data: notFoundErrorSchema,
  },
  CONFLICT: {
    status: 409,
    message: 'Conflict',
    data: conflictErrorSchema,
  },
  UNPROCESSABLE_ENTITY: {
    status: 422,
    message: 'Unprocessable entity',
    data: unprocessableEntityErrorSchema,
  },
} as const;

export type CommonErrorCode = keyof typeof commonErrors;

/**
 * Inverse of `commonErrors`, keyed by HTTP status — lets the frontend reconstruct a
 * typed, `isDefinedError()`-matchable error from the backend's flat `{error, details?}`
 * wire body (see `customErrorResponseBodyEncoder`/`customErrorResponseBodyDecoder` on the
 * server/client oRPC handlers), since the flat body alone drops the `code`.
 */
export const statusToCommonErrorCode: Record<number, CommonErrorCode> = Object.fromEntries(
  Object.entries(commonErrors).map(([code, { status }]) => [status, code as CommonErrorCode])
);
