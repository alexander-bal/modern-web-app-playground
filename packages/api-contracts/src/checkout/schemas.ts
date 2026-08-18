import { z } from 'zod';
import { cartItemSchema } from '../cart/schemas.js';

export const addressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  countryCode: z
    .string()
    .length(2, 'Country code must be a 2-letter ISO 3166-1 alpha-2 code')
    .toUpperCase(),
  phone: z.string().optional(),
});

export const checkoutRequestSchema = z
  .object({
    shippingAddress: addressSchema.optional(),
    shippingAddressId: z.uuid().optional(),
    billingAddress: addressSchema.optional(),
    billingAddressId: z.uuid().optional(),
    billingSameAsShipping: z.boolean().default(false),
    saveShippingAddress: z.boolean().optional(),
    saveBillingAddress: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Shipping: exactly one of shippingAddress or shippingAddressId
    if (data.shippingAddress && data.shippingAddressId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either shippingAddress or shippingAddressId, not both',
        path: ['shippingAddressId'],
      });
    }
    if (!data.shippingAddress && !data.shippingAddressId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Shipping address is required',
        path: ['shippingAddress'],
      });
    }
    // Cannot save an already-saved address
    if (data.saveShippingAddress && data.shippingAddressId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Cannot save an already-saved address',
        path: ['saveShippingAddress'],
      });
    }
    if (data.saveBillingAddress && data.billingAddressId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Cannot save an already-saved address',
        path: ['saveBillingAddress'],
      });
    }
    // Billing: cannot have both billingAddress and billingAddressId
    if (data.billingAddress && data.billingAddressId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either billingAddress or billingAddressId, not both',
        path: ['billingAddressId'],
      });
    }
  });

export const checkoutResponseSchema = z.object({
  id: z.uuid(),
  orderNumber: z.string(),
  status: z.string(),
  orderDate: z.string(),
  currency: z.string(),
  subtotal: z.string(),
  taxAmount: z.string(),
  discountAmount: z.string(),
  shippingAmount: z.string(),
  totalAmount: z.string(),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  items: z.array(cartItemSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Address = z.infer<typeof addressSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
