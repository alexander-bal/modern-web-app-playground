export { addressesContract } from '@mercado/api-contracts';
export { registerAddressesRoutes } from './api/addresses.routes.js';

export type { Address, AddressWithoutUserId } from './domain/address.entity.js';

export {
  AddressLimitError,
  AddressNotFoundError,
  addressesService,
} from './services/addresses.service.js';
