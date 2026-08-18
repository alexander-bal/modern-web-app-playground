import { HttpResponse, http, type JsonBodyType, type RequestHandler } from 'msw';

export type HandlerMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface HandlerOverride {
  method: HandlerMethod;
  url: string;
  status?: number;
  body?: JsonBodyType;
  once?: boolean;
  /** Simulates a slow response, for asserting loading states. */
  delayMs?: number;
}

/**
 * Marks a response as MSW-mocked. The leak guard (tests-integration/helpers/leak-guard.ts) checks
 * for this header on every /api response — Vite's dev proxy returns a normal HTTP 500 (not a
 * failed connection) when its upstream is unreachable, so a missing header, not a request
 * failure, is what actually distinguishes an escaped request from a real one.
 */
export function mockJson(body: JsonBodyType, init?: { status?: number }): Response {
  return HttpResponse.json(body, {
    status: init?.status,
    headers: { 'x-msw-mocked': 'true' },
  });
}

export function buildHandler(override: HandlerOverride): RequestHandler {
  const { method, url, status = 200, body, once, delayMs } = override;
  return http[method](
    url,
    async () => {
      if (delayMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return mockJson(body, { status });
    },
    once ? { once: true } : undefined
  );
}
