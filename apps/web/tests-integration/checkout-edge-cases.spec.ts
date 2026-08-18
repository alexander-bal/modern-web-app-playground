import { makeCheckoutResponse } from '../src/mocks/data/checkout.js';
import { expect, test } from './fixtures.js';

test.describe('checkout — edge cases', () => {
  test('redirects to cart when the cart is empty', async ({ page, mswControl, checkoutPage }) => {
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/cart',
      body: { items: [], subtotal: '0.00', itemCount: 0, currency: 'USD' },
    });
    await checkoutPage.goto();

    await expect(page).toHaveURL('/cart');
  });

  test('redirects to login when unauthenticated', async ({ page, mswControl, checkoutPage }) => {
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/auth/get-session',
      body: null,
    });
    await checkoutPage.goto();

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout/);
  });

  test('surfaces an out-of-stock validation error without navigating away', async ({
    mswControl,
    checkoutPage,
  }) => {
    await checkoutPage.goto();
    await mswControl.use({
      method: 'post',
      url: '/api/checkout',
      status: 422,
      body: { error: 'One or more items are out of stock' },
    });

    await checkoutPage.placeOrder();

    await expect(checkoutPage.errorAlert).toContainText('One or more items are out of stock');
    await expect(checkoutPage.heading).toBeVisible();
  });

  test('shows a generic error and re-enables Place Order on server failure', async ({
    mswControl,
    checkoutPage,
  }) => {
    await checkoutPage.goto();
    await mswControl.use({
      method: 'post',
      url: '/api/checkout',
      status: 500,
      body: { error: 'Internal error' },
    });

    await checkoutPage.placeOrder();

    await expect(checkoutPage.errorAlert).toContainText('Failed to place order. Please try again.');
    await expect(checkoutPage.placeOrderButton).toBeEnabled();
  });

  test('shows a loading state while checkout is in flight', async ({
    page,
    mswControl,
    checkoutPage,
  }) => {
    await checkoutPage.goto();
    await mswControl.use({
      method: 'post',
      url: '/api/checkout',
      body: makeCheckoutResponse(),
      delayMs: 500,
    });

    await checkoutPage.placeOrder();

    // The button's accessible name switches to a spinner while pending, so it drops out of the
    // getByRole('button', { name: 'Place Order' }) locator — assert on the spinner instead.
    await expect(page.getByRole('progressbar')).toBeVisible();
  });
});
