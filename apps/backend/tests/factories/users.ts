import type { Database } from '../../src/db/index.js';
import { db, user } from '../../src/db/index.js';
import type { NewUser, User } from '../../src/db/schema.js';

/**
 * Build test user data with default values that can be overridden
 */
function buildTestUserData(overrides: Partial<NewUser> = {}): NewUser {
  const timestamp = Date.now();
  const firstName = overrides.firstName ?? 'Test';
  const lastName = overrides.lastName ?? 'User';
  const userData: NewUser = {
    name: overrides.name ?? `${firstName} ${lastName}`,
    firstName,
    lastName,
    email: overrides.email ?? `test.user.${timestamp}@example.com`,
    emailVerified: overrides.emailVerified ?? false,
    isAdmin: overrides.isAdmin ?? false,
    phone: overrides.phone ?? null,
    locale: overrides.locale ?? 'en-GB',
    adminRole: overrides.adminRole ?? null,
    adminCompanyIds: overrides.adminCompanyIds ?? null,
    config: overrides.config ?? {},
    isOptedInToMarketing: overrides.isOptedInToMarketing ?? false,
    plainCustomerId: overrides.plainCustomerId ?? null,
    plainLastSyncedAt: overrides.plainLastSyncedAt ?? null,
  };

  // Add ID if provided (for cases where we need a specific ID)
  if (overrides.id) {
    return { ...userData, id: overrides.id };
  }

  return userData;
}

/**
 * Create a test user record in the database with default values that can be overridden
 */
export async function createTestUser(
  overrides: Partial<NewUser> = {},
  database: Database = db
): Promise<User> {
  const userData = buildTestUserData(overrides);
  const results = await database.insert(user).values(userData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test user');
  }

  return results[0];
}
