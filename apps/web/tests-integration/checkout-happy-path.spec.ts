import { expect, test } from './fixtures.js';

test.describe('checkout — happy path', () => {
  test('places an order using the saved default address', async ({
    page,
    checkoutPage,
    orderConfirmationPage,
  }) => {
    await checkoutPage.goto();
    await expect(checkoutPage.heading).toBeVisible();
    await expect(checkoutPage.orderSummaryHeading).toBeVisible();

    await checkoutPage.placeOrder();

    await expect(page).toHaveURL(/\/orders\/ORD-1001\/confirmation/);
    await expect(orderConfirmationPage.heading).toBeVisible();
    await expect(orderConfirmationPage.orderNumber).toBeVisible();
  });

  test('places an order with a newly entered address and saves it', async ({
    page,
    mswControl,
    checkoutPage,
    orderConfirmationPage,
  }) => {
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/v1/addresses',
      body: { addresses: [] },
    });
    await checkoutPage.goto();
    await expect(checkoutPage.heading).toBeVisible();

    await checkoutPage.fillShippingAddress({
      fullName: 'John Smith',
      addressLine1: '456 Oak Ave',
      city: 'Portland',
      postalCode: '97201',
      countryCode: 'US',
    });
    await checkoutPage.checkSaveAddress();

    const [checkoutRequest] = await Promise.all([
      page.waitForRequest('**/api/checkout'),
      checkoutPage.placeOrder(),
    ]);
    const requestBody = checkoutRequest.postDataJSON();
    expect(requestBody.saveShippingAddress).toBe(true);
    expect(requestBody.shippingAddress).toMatchObject({
      fullName: 'John Smith',
      addressLine1: '456 Oak Ave',
      city: 'Portland',
    });

    await expect(page).toHaveURL(/\/orders\/ORD-1001\/confirmation/);
    await expect(orderConfirmationPage.heading).toBeVisible();
  });
});
