import type { CartResponse } from '@mercado/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '../lib/api-client';

/** Cart-item update/remove mutations with optimistic writes and rollback on failure. */
export function useCartOptimisticMutations() {
  const queryClient = useQueryClient();
  const cartKey = orpc.cart.getCart.queryKey();

  const updateItemMutation = useMutation(
    orpc.cart.updateItem.mutationOptions({
      onMutate: async (vars) => {
        await queryClient.cancelQueries({ queryKey: cartKey });
        const previous = queryClient.getQueryData<CartResponse>(cartKey);

        queryClient.setQueryData<CartResponse>(cartKey, (old) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            items: old.items.map((item) =>
              item.id === vars.params.itemId
                ? {
                    ...item,
                    quantity: vars.body.quantity,
                    lineTotal: (Number.parseFloat(item.unitPrice) * vars.body.quantity).toFixed(2),
                  }
                : item
            ),
          };
        });

        return { previous };
      },
      onError: (_error, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(cartKey, context.previous);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: cartKey });
      },
    })
  );

  const removeItemMutation = useMutation(
    orpc.cart.removeItem.mutationOptions({
      onMutate: async (vars) => {
        await queryClient.cancelQueries({ queryKey: cartKey });
        const previous = queryClient.getQueryData<CartResponse>(cartKey);

        queryClient.setQueryData<CartResponse>(cartKey, (old) => {
          if (!old) {
            return old;
          }

          return { ...old, items: old.items.filter((item) => item.id !== vars.params.itemId) };
        });

        return { previous };
      },
      onError: (_error, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(cartKey, context.previous);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: cartKey });
      },
    })
  );

  return { updateItemMutation, removeItemMutation, cartKey };
}
