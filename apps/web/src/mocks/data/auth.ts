import type { UserProfile } from '@mercado/api-contracts';

export function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: crypto.randomUUID(),
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    isAdmin: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}
