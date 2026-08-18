import type { Locator, Page } from '@playwright/test';

export interface AddressFormData {
  fullName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
  isDefault?: boolean;
}

export class AddressesPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly addAddressButton: Locator;
  readonly addressCards: Locator;
  readonly emptyState: Locator;
  readonly fullNameInput: Locator;
  readonly addressLine1Input: Locator;
  readonly cityInput: Locator;
  readonly postalCodeInput: Locator;
  readonly countryCodeInput: Locator;
  readonly setDefaultCheckbox: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: 'Address Book', level: 1 });
    this.addAddressButton = page.getByRole('button', { name: 'Add Address' });
    this.addressCards = page.getByTestId('address-card');
    this.emptyState = page.getByText('No saved addresses yet');
    this.fullNameInput = page.getByLabel('Full Name');
    this.addressLine1Input = page.getByLabel('Address Line 1');
    this.cityInput = page.getByLabel('City');
    this.postalCodeInput = page.getByLabel('Postal Code');
    this.countryCodeInput = page.getByLabel('Country Code');
    this.setDefaultCheckbox = page.getByRole('checkbox', { name: 'Set as default' });
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/account/addresses');
  }

  async openAddForm(): Promise<void> {
    await this.addAddressButton.click();
  }

  async fillAddressForm(address: AddressFormData): Promise<void> {
    await this.fullNameInput.fill(address.fullName);
    await this.addressLine1Input.fill(address.addressLine1);
    await this.cityInput.fill(address.city);
    await this.postalCodeInput.fill(address.postalCode);
    await this.countryCodeInput.fill(address.countryCode);
    if (address.isDefault) {
      await this.setDefaultCheckbox.check();
    }
  }

  async submitForm(): Promise<void> {
    await this.saveButton.click();
  }

  async getAddressCount(): Promise<number> {
    return this.addressCards.count();
  }

  async setAddressAsDefault(index: number): Promise<void> {
    await this.addressCards.nth(index).getByRole('button', { name: 'Set as Default' }).click();
  }

  async deleteAddress(index: number): Promise<void> {
    await this.addressCards.nth(index).getByRole('button', { name: 'Delete' }).click();
  }

  async getDefaultAddressIndex(): Promise<number> {
    const count = await this.addressCards.count();
    for (let i = 0; i < count; i++) {
      const hasDefault = await this.addressCards.nth(i).getByTestId('default-chip').isVisible();
      if (hasDefault) return i;
    }
    return -1;
  }
}
