import { z } from 'zod';

export const savedAddressSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postalCode: z.string(),
  countryCode: z.string().length(2),
  phone: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createAddressBodySchema = z.object({
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
  isDefault: z.boolean().optional(),
});

export const updateAddressBodySchema = createAddressBodySchema.partial();

export const listAddressesResponseSchema = z.object({
  addresses: z.array(savedAddressSchema),
});

export type SavedAddress = z.infer<typeof savedAddressSchema>;
export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;
export type UpdateAddressBody = z.infer<typeof updateAddressBodySchema>;
export type ListAddressesResponse = z.infer<typeof listAddressesResponseSchema>;
