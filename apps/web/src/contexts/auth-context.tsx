import type { UserProfile } from '@mercado/api-contracts';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext } from 'react';
import { api, tsr } from '../lib/api-client';
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

  const { data, isPending } = tsr.auth.me.useQuery({
    queryKey: AUTH_ME_KEY,
    // An anonymous visitor gets 401, which this client throws; retrying it would double
    // every cold page load and hold the auth gate on a spinner through the backoff.
    retry: false,
    // A 401 keeps the last successful data, so a focus refetch could not surface an
    // expired session anyway.
    refetchOnWindowFocus: false,
  });

  const user = data?.status === 200 ? data.body : null;

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.auth.login({
        body: { email, password },
      });

      if (response.status === 200) {
        // Cancel first: invalidate only cancels a refetch of a query that already holds data,
        // so an anonymous /me still in flight from mount would instead be awaited and its 401
        // would decide the session. The response already carries the profile, so seed the cache
        // with it rather than depend on another /me that could fail and strand a live session.
        await queryClient.cancelQueries({ queryKey: AUTH_ME_KEY });
        queryClient.setQueryData(AUTH_ME_KEY, response);
        invalidateCart();
      } else {
        throw new Error('Invalid email or password');
      }
    },
    [queryClient, invalidateCart]
  );

  const register = useCallback(
    async (firstName: string, lastName: string, email: string, password: string) => {
      const response = await api.auth.register({
        body: { firstName, lastName, email, password },
      });

      if (response.status === 201) {
        await queryClient.cancelQueries({ queryKey: AUTH_ME_KEY });
        // Register answers 201 where the session check answers 200; the profile body is the same.
        queryClient.setQueryData(AUTH_ME_KEY, { ...response, status: 200 as const });
        invalidateCart();
      } else if (response.status === 409) {
        throw new Error(response.body.error);
      } else {
        throw new Error('Registration failed');
      }
    },
    [queryClient, invalidateCart]
  );

  const logout = useCallback(async () => {
    await api.auth.logout({ body: {} });
    // Reset, not refetch: a query that errors keeps its last successful data, so refetching
    // into the 401 would leave the signed-out user still reading as signed in. Reset clears the
    // data and notifies subscribers, which `removeQueries` does not do for an active query.
    await queryClient.resetQueries({ queryKey: AUTH_ME_KEY });
    invalidateCart();
  }, [queryClient, invalidateCart]);

  return (
    <AuthContext.Provider value={{ user, loading: isPending, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
