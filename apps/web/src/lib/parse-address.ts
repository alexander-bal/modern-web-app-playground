import { type Address, addressSchema } from '@mercado/api-contracts';

/** Orders expose shipping and billing addresses as JSON strings; returns null when absent or malformed. */
export function parseAddress(addressJson: string | null | undefined): Address | null {
  if (!addressJson) return null;

  try {
    const result = addressSchema.safeParse(JSON.parse(addressJson));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
