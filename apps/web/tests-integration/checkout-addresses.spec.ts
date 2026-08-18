import { makeSavedAddress } from '../src/mocks/data/addresses.js';
import { expect, test } from './fixtures.js';

test.describe('checkout — saved addresses', () => {
  test('shows the new-address form when there are no saved addresses', async ({
    mswControl,
    checkoutPage,
  }) => {
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/v1/addresses',
      body: { addresses: [] },
    });
    await checkoutPage.goto();

    await expect(checkoutPage.fullNameInput).toBeVisible();
    await expect(checkoutPage.savedAddressRadios).toHaveCount(0);
  });

  test('pre-selects the default address among multiple saved addresses', async ({
    page,
    mswControl,
    checkoutPage,
  }) => {
    const defaultAddress = makeSavedAddress({ fullName: 'Default Addressee', isDefault: true });
    const other = makeSavedAddress({ fullName: 'Other Addressee', isDefault: false });
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/v1/addresses',
      body: { addresses: [other, defaultAddress] },
    });
    await checkoutPage.goto();

    await expect(page.getByTestId(`shipping-radio-${defaultAddress.id}`)).toBeChecked();
  });

  test('allows selecting a non-default saved address', async ({
    page,
    mswControl,
    checkoutPage,
  }) => {
    const defaultAddress = makeSavedAddress({ fullName: 'Default Addressee', isDefault: true });
    const other = makeSavedAddress({ fullName: 'Other Addressee', isDefault: false });
    await mswControl.useBeforeLoad({
      method: 'get',
      url: '/api/v1/addresses',
      body: { addresses: [defaultAddress, other] },
    });
    await checkoutPage.goto();

    // 2 saved addresses + "Enter a new address"
    await expect(checkoutPage.savedAddressRadios).toHaveCount(3);
    await page.getByTestId(`shipping-radio-${other.id}`).click();
    await expect(page.getByTestId(`shipping-radio-${other.id}`)).toBeChecked();
  });
});
