import { Minus, Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { tsr } from '../lib/api-client';

interface Props {
  productId: string;
  productName: string;
}

export function ProductCardCartControls({ productId, productName }: Props) {
  const queryClient = useQueryClient();
  const [pendingQty, setPendingQty] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);

  const { data, isPending: cartLoading } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });

  const cart = data?.status === 200 ? data.body : null;
  const cartItem = cart?.items.find((item) => item.productId === productId) ?? null;

  const addItemMutation = tsr.cart.addItem.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setPendingQty(1);
      setAddError(null);
    },
    onError: () => {
      setAddError('Failed to add item');
    },
  });

  const updateItemMutation = tsr.cart.updateItem.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previous = queryClient.getQueryData(['cart']);
      queryClient.setQueryData(['cart'], (old: typeof data) => {
        if (old?.status !== 200) return old;
        return {
          ...old,
          body: {
            ...old.body,
            items: old.body.items.map((item) =>
              item.id === vars.params.itemId
                ? {
                    ...item,
                    quantity: vars.body.quantity,
                    lineTotal: (Number.parseFloat(item.unitPrice) * vars.body.quantity).toFixed(2),
                  }
                : item
            ),
          },
        };
      });
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(['cart'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeItemMutation = tsr.cart.removeItem.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previous = queryClient.getQueryData(['cart']);
      queryClient.setQueryData(['cart'], (old: typeof data) => {
        if (old?.status !== 200) return old;
        return {
          ...old,
          body: {
            ...old.body,
            items: old.body.items.filter((item) => item.id !== vars.params.itemId),
          },
        };
      });
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(['cart'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const isMutating = updateItemMutation.isPending || removeItemMutation.isPending;

  if (cartLoading) {
    return (
      <div className="flex justify-center py-2">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (cartItem) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2">
        <Button
          size="icon-sm"
          variant="secondary"
          onClick={() => {
            if (cartItem.quantity === 1) {
              removeItemMutation.mutate({ params: { itemId: cartItem.id } });
            } else {
              updateItemMutation.mutate({
                params: { itemId: cartItem.id },
                body: { quantity: cartItem.quantity - 1 },
              });
            }
          }}
          disabled={isMutating}
          aria-label={
            cartItem.quantity === 1
              ? `Remove one ${productName} from cart`
              : `Decrease quantity of ${productName}`
          }
        >
          <Minus />
        </Button>

        <span aria-live="polite" className="min-w-7 text-center font-bold">
          {cartItem.quantity}
        </span>

        <Button
          size="icon-sm"
          variant="secondary"
          onClick={() =>
            updateItemMutation.mutate({
              params: { itemId: cartItem.id },
              body: { quantity: cartItem.quantity + 1 },
            })
          }
          disabled={isMutating}
          aria-label={`Increase quantity of ${productName}`}
        >
          <Plus />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {addError && (
        <Alert variant="destructive" className="mb-2 text-xs">
          <AlertDescription>{addError}</AlertDescription>
          <AlertAction>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setAddError(null)}
              aria-label="Dismiss error"
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="mb-2 flex items-center justify-center gap-2">
        <Button
          size="icon-xs"
          variant="secondary"
          onClick={() => setPendingQty((q) => Math.max(1, q - 1))}
          disabled={pendingQty <= 1 || addItemMutation.isPending}
          aria-label={`Decrease quantity of ${productName}`}
        >
          <Minus />
        </Button>
        <span className="min-w-6 text-center text-sm font-bold">{pendingQty}</span>
        <Button
          size="icon-xs"
          variant="secondary"
          onClick={() => setPendingQty((q) => q + 1)}
          disabled={addItemMutation.isPending}
          aria-label={`Increase quantity of ${productName}`}
        >
          <Plus />
        </Button>
      </div>

      <Button
        className="w-full"
        disabled={addItemMutation.isPending}
        onClick={() => addItemMutation.mutate({ body: { productId, quantity: pendingQty } })}
        aria-label={`Add ${productName} to cart`}
      >
        {addItemMutation.isPending ? 'Adding…' : 'Add to Cart'}
      </Button>
    </div>
  );
}
