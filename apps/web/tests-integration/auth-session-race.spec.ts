import { makeUser } from '../src/mocks/data/auth.js';
import { expect, test } from './fixtures.js';

const SLOW_ME_MS = 3000;

test.describe('auth — session check race', () => {
  test('a slow anonymous session check cannot revert a login that beat it', async ({
    page,
    mswControl,
  }) => {
    const user = makeUser({ firstName: 'Ada', lastName: 'Lovelace' });

    // Only real responses count as the check having resolved; an aborted request is the
    // behavior under test, not a settled one.
    const sessionCheckResponses: number[] = [];
    let loginResponseAt = Number.POSITIVE_INFINITY;
    page.on('response', (response) => {
      const { pathname } = new URL(response.url());
      if (pathname === '/api/auth/me') sessionCheckResponses.push(Date.now());
      if (pathname === '/api/auth/login') loginResponseAt = Date.now();
    });

    // Applies to the session check fired on mount, which is then left hanging for SLOW_ME_MS.
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/auth/me',
      status: 401,
      body: { error: 'Unauthorized' },
      delayMs: SLOW_ME_MS,
    });

    await page.goto('/login');

    // Swapped once the mount request is already in flight: MSW applies overrides to future
    // requests only, so the hanging 401 stays on its timer while the post-login refetch gets 200.
    await mswControl.use(
      { method: 'get', url: '/api/auth/me', body: user },
      { method: 'post', url: '/api/auth/login', body: user },
      // Logging in navigates to the catalog, which the default handlers do not cover.
      {
        method: 'get',
        url: '/api/products',
        body: { products: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      }
    );

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();

    // Guards the setup: had the anonymous check already answered before the login landed, there
    // would have been no race, and everything below would pass without exercising anything.
    expect(sessionCheckResponses.filter((at) => at < loginResponseAt)).toEqual([]);

    // Deliberate wait, not a poll: the assertion is that nothing happens once the stale response
    // is due, so the test has to sit past its arrival to be meaningful.
    await page.waitForTimeout(SLOW_ME_MS);

    await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  });
});
