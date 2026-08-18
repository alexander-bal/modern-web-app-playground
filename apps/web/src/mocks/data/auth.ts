export interface MockAuthUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  image: null;
}

export interface MockAuthSession {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
  };
  user: MockAuthUser;
}

function makeUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  const firstName = overrides.firstName ?? 'Jane';
  const lastName = overrides.lastName ?? 'Doe';

  return {
    id: crypto.randomUUID(),
    email: 'jane.doe@example.com',
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    isAdmin: false,
    emailVerified: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    image: null,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<MockAuthUser> = {}): MockAuthSession {
  const user = makeUser(overrides);
  const now = new Date().toISOString();

  return {
    session: {
      id: crypto.randomUUID(),
      userId: user.id,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
    },
    user,
  };
}
