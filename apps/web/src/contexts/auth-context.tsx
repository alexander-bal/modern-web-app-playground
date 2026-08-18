import type { UserProfile } from '@mercado/api-contracts';
import { isDefinedError, safe } from '@orpc/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext } from 'react';
import { authClient } from '../lib/api-client';
import { useCart } from './cart-context';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AUTH_ME_KEY = ['auth', 'me'];

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { invalidateCart } = useCart();

  const { data: user, isPending } = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: async () => {
      const [error, data] = await safe(authClient.me());
      return error ? null : data;
    },
    // An anonymous visitor's /me throws, which this client surfaces as a query error;
    // retrying it would double every cold page load and hold the auth gate on a spinner
    // through the backoff.
    retry: false,
    // A failed /me keeps the last successful data, so a focus refetch could not surface
    // an expired session anyway.
    refetchOnWindowFocus: false,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const [error, data] = await safe(authClient.login({ email, password }));

      if (error) {
        throw new Error('Invalid email or password');
      }

      // Cancel first: invalidate only cancels a refetch of a query that already holds data,
      // so an anonymous /me still in flight from mount would instead be awaited and its
      // failure would decide the session. The response already carries the profile, so seed
      // the cache with it rather than depend on another /me that could fail and strand a live
      // session.
      await queryClient.cancelQueries({ queryKey: AUTH_ME_KEY });
      queryClient.setQueryData(AUTH_ME_KEY, data);
      invalidateCart();
    },
    [queryClient, invalidateCart]
  );

  const register = useCallback(
    async (firstName: string, lastName: string, email: string, password: string) => {
      const [error, data] = await safe(
        authClient.register({ firstName, lastName, email, password })
      );

      if (error) {
        if (isDefinedError(error) && error.code === 'CONFLICT') {
          throw new Error(error.data.error);
        }
        throw new Error('Registration failed');
      }

      await queryClient.cancelQueries({ queryKey: AUTH_ME_KEY });
      queryClient.setQueryData(AUTH_ME_KEY, data);
      invalidateCart();
    },
    [queryClient, invalidateCart]
  );

  const logout = useCallback(async () => {
    // Clear local session state even if the server call fails — a failed logout
    // request shouldn't leave the UI showing the user as still signed in.
    await safe(authClient.logout());
    // Reset, not refetch: a query that errors keeps its last successful data, so refetching
    // into the failure would leave the signed-out user still reading as signed in. Reset
    // clears the data and notifies subscribers, which `removeQueries` does not do for an
    // active query.
    await queryClient.resetQueries({ queryKey: AUTH_ME_KEY });
    invalidateCart();
  }, [queryClient, invalidateCart]);

  return (
    <AuthContext.Provider
      value={{ user: user ?? null, loading: isPending, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
