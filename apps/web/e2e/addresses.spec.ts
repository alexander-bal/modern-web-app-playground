import { expect, test } from './fixtures/test-base.js';

const address1 = {
  fullName: 'Alice Smith',
  addressLine1: '123 Main St',
  city: 'New York',
  postalCode: '10001',
  countryCode: 'US',
};

const address2 = {
  fullName: 'Bob Jones',
  addressLine1: '456 Oak Ave',
  city: 'Los Angeles',
  postalCode: '90001',
  countryCode: 'US',
};

test('address book CRUD — add, set default, delete', async ({ addressesPage }) => {
  await addressesPage.goto();
  await expect(addressesPage.pageTitle).toBeVisible();

  // Empty state
  await expect(addressesPage.emptyState).toBeVisible();

  // Add first address (will become default)
  await addressesPage.openAddForm();
  await addressesPage.fillAddressForm({ ...address1, isDefault: true });
  await addressesPage.submitForm();

  // First address card appears with Default chip
  await expect(addressesPage.addressCards).toHaveCount(1);
  await expect(addressesPage.addressCards.first().getByTestId('default-chip')).toBeVisible();

  // Add second address
  await addressesPage.openAddForm();
  await addressesPage.fillAddressForm(address2);
  await addressesPage.submitForm();

  // Two cards; first is still default
  await expect(addressesPage.addressCards).toHaveCount(2);
  const defaultIndex = await addressesPage.getDefaultAddressIndex();
  expect(defaultIndex).toBe(0);

  // Set second card as default
  await addressesPage.setAddressAsDefault(1);

  // Second card now has Default chip
  await expect(addressesPage.addressCards).toHaveCount(2);
  const newDefaultIndex = await addressesPage.getDefaultAddressIndex();
  expect(newDefaultIndex).toBe(0); // backend returns default first

  // Verify the second address (now default) name is shown
  await expect(addressesPage.addressCards.first()).toContainText(address2.fullName);

  // Delete the first card (the non-default one)
  await addressesPage.deleteAddress(1);

  // Only 1 card remains
  await expect(addressesPage.addressCards).toHaveCount(1);
});
