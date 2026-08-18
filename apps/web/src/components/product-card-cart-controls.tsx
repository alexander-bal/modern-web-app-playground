import { Minus, Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCartOptimisticMutations } from '../hooks/use-cart-optimistic-mutations';
import { orpc } from '../lib/api-client';

interface Props {
  productId: string;
  productName: string;
}

export function ProductCardCartControls({ productId, productName }: Props) {
  const queryClient = useQueryClient();
  const [pendingQty, setPendingQty] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);

  const { data: cart, isPending: cartLoading } = useQuery(orpc.cart.getCart.queryOptions());
  const cartItem = cart?.items.find((item) => item.productId === productId) ?? null;

  const cartKey = orpc.cart.getCart.queryKey();
  const addItemMutation = useMutation(
    orpc.cart.addItem.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: cartKey });
        setPendingQty(1);
        setAddError(null);
      },
      onError: () => {
        setAddError('Failed to add item');
      },
    })
  );

  const { updateItemMutation, removeItemMutation } = useCartOptimisticMutations();

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
        onClick={() => addItemMutation.mutate({ productId, quantity: pendingQty })}
        aria-label={`Add ${productName} to cart`}
      >
        {addItemMutation.isPending ? 'Adding…' : 'Add to Cart'}
      </Button>
    </div>
  );
}
