import { expect, test } from './fixtures/test-base.js';

const defaultAddress = {
  fullName: 'Test User',
  addressLine1: '123 Main St',
  city: 'New York',
  postalCode: '10001',
  countryCode: 'US',
  isDefault: true,
};

const newAddress = {
  fullName: 'New Address',
  addressLine1: '789 Pine Rd',
  city: 'Chicago',
  postalCode: '60601',
  countryCode: 'US',
};

async function addProductToCart(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('product-card').first().waitFor({ state: 'visible' });
  await page.getByTestId('product-card').first().click();
  await page.waitForURL(/\/products\/.+/);
  await page.getByRole('button', { name: /add to cart/i }).click();
  await page.waitForTimeout(300);
}

test('E2E-2 — checkout pre-selects default saved address', async ({
  authenticatedPage,
  apiHelper,
  checkoutPage,
}) => {
  await apiHelper.createAddress(defaultAddress);

  await addProductToCart(authenticatedPage);
  await checkoutPage.goto();

  // Default address radio should be checked
  await expect(checkoutPage.heading).toBeVisible();
  const defaultRadio = authenticatedPage.getByRole('radio').first();
  await expect(defaultRadio).toBeChecked();

  // Place order with saved address
  await checkoutPage.placeOrder();
  await authenticatedPage.waitForURL(/\/orders\/.+\/confirmation/);
  await expect(authenticatedPage.getByText('Order Confirmed')).toBeVisible();
});

test('E2E-3 — save address at checkout', async ({
  authenticatedPage,
  checkoutPage,
  addressesPage,
}) => {
  await addProductToCart(authenticatedPage);
  await checkoutPage.goto();

  // No saved addresses — should show inline form directly
  await expect(checkoutPage.heading).toBeVisible();
  await expect(authenticatedPage.getByLabel('Enter a new address')).not.toBeVisible();

  // Fill inline form
  await checkoutPage.fillShippingAddress(newAddress);

  // Check "Save this address"
  await checkoutPage.checkSaveAddress();

  // Place order
  await checkoutPage.placeOrder();
  await authenticatedPage.waitForURL(/\/orders\/.+\/confirmation/);
  await expect(authenticatedPage.getByText('Order Confirmed')).toBeVisible();

  // Navigate to address book — should have 1 address with Default chip
  await addressesPage.goto();
  await expect(addressesPage.addressCards).toHaveCount(1);
  await expect(addressesPage.addressCards.first().getByTestId('default-chip')).toBeVisible();
});

test('E2E-4 — new inline address without saving', async ({
  authenticatedPage,
  apiHelper,
  checkoutPage,
  addressesPage,
}) => {
  await apiHelper.createAddress(defaultAddress);

  await addProductToCart(authenticatedPage);
  await checkoutPage.goto();

  // Pre-selected saved address is visible
  await expect(checkoutPage.heading).toBeVisible();

  // Select "Enter a new address"
  await checkoutPage.selectNewAddress();

  // Fill inline form (do NOT check save)
  await checkoutPage.fillShippingAddress(newAddress);

  // Place order
  await checkoutPage.placeOrder();
  await authenticatedPage.waitForURL(/\/orders\/.+\/confirmation/);
  await expect(authenticatedPage.getByText('Order Confirmed')).toBeVisible();

  // Address book still has only 1 address
  await addressesPage.goto();
  await expect(addressesPage.addressCards).toHaveCount(1);
});
