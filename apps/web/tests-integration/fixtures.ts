import { test as base } from '@playwright/test';
import { MswControl } from './helpers/msw-control.js';
import { installLeakGuard } from './helpers/leak-guard.js';
import { CartPage } from './pages/cart-page.js';
import { CheckoutPage } from './pages/checkout-page.js';
import { OrderConfirmationPage } from './pages/order-confirmation-page.js';

interface TestFixtures {
  mswControl: MswControl;
  checkoutPage: CheckoutPage;
  cartPage: CartPage;
  orderConfirmationPage: OrderConfirmationPage;
  /** Auto fixture: fails the test if any /api request escaped MSW and hit the network. */
  leakGuard: undefined;
}

export const test = base.extend<TestFixtures>({
  mswControl: async ({ page }, use) => {
    await use(new MswControl(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  orderConfirmationPage: async ({ page }, use) => {
    await use(new OrderConfirmationPage(page));
  },
  leakGuard: [
    async ({ page }, use) => {
      const getLeaks = installLeakGuard(page);
      await use();
      const leaks = getLeaks();
      if (leaks.length > 0) {
        throw new Error(`Unmocked API request(s) reached the network:\n${leaks.join('\n')}`);
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
