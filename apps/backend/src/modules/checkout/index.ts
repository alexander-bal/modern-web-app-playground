export { checkoutContract } from '@mercado/api-contracts';
export { registerCheckoutRoutes } from './api/checkout.routes.js';

export type { Address, CheckoutRequest, CheckoutResponse } from './domain/checkout.types.js';

export {
  CartNotFoundError,
  CheckoutAddressNotFoundError,
  checkoutService,
  EmptyCartError,
  InactiveProductError,
  OrderNotCheckoutEligibleError,
  OrderNumberGenerationError,
} from './services/checkout.service.js';
