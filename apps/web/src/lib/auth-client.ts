import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export const { useSession, signIn, signOut } = authClient;

export interface SignUpEmailInput {
  email: string;
  password: string;
  name: string;
  firstName: string;
  lastName: string;
}

// `firstName`/`lastName` are `additionalFields` on the server; the client's inferred
// sign-up type doesn't yet include them, so this widens the input type at the one
// call site that needs them rather than fighting for full inference.
export function signUpEmail(input: SignUpEmailInput) {
  return authClient.signUp.email(input as Parameters<typeof authClient.signUp.email>[0]);
}
