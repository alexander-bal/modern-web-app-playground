import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext } from 'react';
import { orpc } from '../lib/api-client';

interface CartContextValue {
  itemCount: number;
  invalidateCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  itemCount: 0,
  invalidateCart: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery(orpc.cart.getCart.queryOptions());
  const queryClient = useQueryClient();

  const itemCount = data?.itemCount ?? 0;
  const cartKey = orpc.cart.getCart.queryKey();

  const invalidateCart = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: cartKey });
  }, [queryClient, cartKey]);

  return (
    <CartContext.Provider value={{ itemCount, invalidateCart }}>{children}</CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  return useContext(CartContext);
}
