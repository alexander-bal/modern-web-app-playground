import type { NewCompany } from '../../src/db/schema';

/**
 * Build test company data with default values that can be overridden
 * Use this when you only need the data structure, not a database record
 */
export function buildTestCompanyData(overrides: Partial<NewCompany> = {}): NewCompany {
  return {
    name: 'Test Company',
    billingInboundToken: crypto.randomUUID(),
    bobReferenceId: overrides.bobReferenceId ?? null,
    ...overrides,
  };
}
