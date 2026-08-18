import type { cartItemSchema, cartResponseSchema } from '@mercado/api-contracts';
import type { z } from 'zod';

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartResponse = z.infer<typeof cartResponseSchema>;

/**
 * Cart identifier - discriminated union for user vs guest
 */
export type CartIdentifier =
  | { type: 'user'; userId: string }
  | { type: 'guest'; cartToken?: string };
