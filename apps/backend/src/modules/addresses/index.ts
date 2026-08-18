export { addressesOrpcRouter } from './api/addresses.routes.js';

export {
  countAddressesByUserId,
  findAddressByIdAndUserId,
  hasDefaultAddress,
  insertAddress,
} from './repositories/addresses.repository.js';
