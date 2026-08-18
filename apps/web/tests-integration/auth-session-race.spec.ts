import { makeSession } from '../src/mocks/data/auth.js';
import { expect, test } from './fixtures.js';

const SLOW_SESSION_CHECK_MS = 3000;

test.describe('auth — session check race', () => {
  test('a slow anonymous session check cannot revert a login that beat it', async ({
    page,
    mswControl,
  }) => {
    const session = makeSession({ firstName: 'Ada', lastName: 'Lovelace' });

    // Applies to the session check the client fires on mount, which is then left hanging
    // for SLOW_SESSION_CHECK_MS.
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/auth/get-session',
      body: null,
      delayMs: SLOW_SESSION_CHECK_MS,
    });

    await page.goto('/login');

    // Swapped once the mount request is already in flight: MSW applies overrides to future
    // requests only, so the hanging null-session response stays on its timer while the
    // post-login session check gets the authenticated session.
    await mswControl.use(
      { method: 'get', url: '/api/auth/get-session', body: session },
      {
        method: 'post',
        url: '/api/auth/sign-in/email',
        body: { redirect: false, token: session.session.token, url: undefined, user: session.user },
      },
      // Logging in navigates to the catalog, which the default handlers do not cover.
      {
        method: 'get',
        url: '/api/products',
        body: { products: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      }
    );

    await page.getByLabel('Email').fill(session.user.email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(
      page.getByText(`${session.user.firstName} ${session.user.lastName}`)
    ).toBeVisible();

    // Deliberate wait, not a poll: the assertion is that nothing happens once the stale response
    // is due, so the test has to sit past its arrival to be meaningful. React 19 StrictMode can
    // double-invoke the effect that mounts Better Auth's session store, so response counts/timing
    // before sign-in aren't a reliable proxy for whether a race was exercised — the outcome is.
    await page.waitForTimeout(SLOW_SESSION_CHECK_MS);

    await expect(
      page.getByText(`${session.user.firstName} ${session.user.lastName}`)
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  });
});
