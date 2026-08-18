import type { Page } from '@playwright/test';

/**
 * Fails the test if any /api request escapes MSW and hits the network. A `requestfailed` check
 * doesn't work here: no backend runs for this test layer, but Vite's dev proxy catches the
 * unreachable-upstream error itself and returns a normal HTTP 500 — the browser sees a completed
 * response, not a failed connection. Every mocked response instead carries an `x-msw-mocked`
 * header (see src/mocks/build-handler.ts); its absence on an /api response is what actually
 * indicates the request reached the real proxy instead of the mock worker.
 */
export function installLeakGuard(page: Page): () => string[] {
  const leaks: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/') && !response.headers()['x-msw-mocked']) {
      leaks.push(
        `${response.request().method()} ${url} — ${response.status()} (no x-msw-mocked header)`
      );
    }
  });
  return () => leaks;
}
