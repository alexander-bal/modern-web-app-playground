import type { Address as DbAddress, NewAddress } from '../../../db/schema.js';

export type Address = DbAddress;
export type NewAddressEntity = NewAddress;

export interface AddressWithoutUserId {
  id: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
