import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';

export function CartPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });

  const cart = data?.status === 200 ? data.body : null;

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

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
      if (context?.previous) {
        queryClient.setQueryData(['cart'], context.previous);
      }
      setError('Failed to update quantity');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItemMutation.mutate({
      params: { itemId },
      body: { quantity: newQuantity },
    });
  };

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
      if (context?.previous) {
        queryClient.setQueryData(['cart'], context.previous);
      }
      setError('Failed to remove item');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeItem = (itemId: string) => {
    removeItemMutation.mutate({
      params: { itemId },
    });
  };

  if (isPending) {
    return (
      <Container>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner className="size-10" />
        </div>
      </Container>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Container className="py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Shopping Cart</h1>
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-muted">
            <ShoppingCart className="size-12 text-primary" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Your cart is empty</h2>
          <p className="mb-6 text-sm text-muted-foreground">Add some products to get started!</p>
          <Link to="/" className={buttonVariants({ size: 'lg' })}>
            Continue Shopping
          </Link>
        </div>
      </Container>
    );
  }

  const dismissibleErrors = [
    error ? { key: 'cart', message: error, dismiss: () => setError(null) } : null,
    updateItemMutation.error
      ? {
          key: 'update',
          message:
            updateItemMutation.error instanceof Error
              ? updateItemMutation.error.message
              : 'Failed to update item',
          dismiss: () => updateItemMutation.reset(),
        }
      : null,
    removeItemMutation.error
      ? {
          key: 'remove',
          message:
            removeItemMutation.error instanceof Error
              ? removeItemMutation.error.message
              : 'Failed to remove item',
          dismiss: () => removeItemMutation.reset(),
        }
      : null,
  ].filter((e) => e !== null);

  return (
    <Container className="py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Shopping Cart</h1>

      {dismissibleErrors.map((e) => (
        <Alert key={e.key} variant="destructive" className="mb-4">
          <AlertDescription>{e.message}</AlertDescription>
          <AlertAction>
            <Button size="icon-xs" variant="ghost" onClick={e.dismiss} aria-label="Dismiss error">
              <X />
            </Button>
          </AlertAction>
        </Alert>
      ))}

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="min-w-0 flex-1">
          {cart.items.map((item) => (
            <div
              key={item.id}
              data-testid="cart-item"
              className="mb-4 rounded-xl border bg-card p-6 shadow-sm"
            >
              <div className="flex gap-4">
                <img
                  src={item.productImageUrl ?? noPhoto}
                  alt={item.productName}
                  className={`size-30 shrink-0 rounded-lg bg-muted ${
                    item.productImageUrl ? 'object-cover' : 'object-none'
                  }`}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="mb-1 text-lg font-semibold">{item.productName}</h2>
                  <p className="mb-1 text-sm text-muted-foreground">SKU: {item.productSku}</p>
                  <p className="mt-auto">{formatPrice(item.unitPrice, item.currency)}</p>
                </div>

                <div className="flex min-w-38 flex-col items-end justify-between">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    data-testid="remove-cart-item"
                    aria-label={`Remove ${item.productName} from cart`}
                    onClick={() => removeItem(item.id)}
                    disabled={removeItemMutation.isPending || updateItemMutation.isPending}
                  >
                    <Trash2 />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      data-testid="decrease-quantity"
                      aria-label={`Decrease quantity of ${item.productName}`}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={
                        item.quantity <= 1 ||
                        updateItemMutation.isPending ||
                        removeItemMutation.isPending
                      }
                    >
                      <Minus />
                    </Button>
                    <span data-testid="cart-item-quantity" className="min-w-8 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      data-testid="increase-quantity"
                      aria-label={`Increase quantity of ${item.productName}`}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={updateItemMutation.isPending || removeItemMutation.isPending}
                    >
                      <Plus />
                    </Button>
                  </div>

                  <p className="text-lg font-bold">{formatPrice(item.lineTotal, item.currency)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit w-full rounded-xl border bg-card p-6 shadow-sm md:w-75 md:shrink-0">
          <h2 className="mb-2 text-lg font-semibold">Cart Summary</h2>
          <Separator className="my-4" />

          <div className="mb-2 flex justify-between">
            <p>Items:</p>
            <p>{cart.itemCount}</p>
          </div>

          <div className="mb-4 flex justify-between">
            <p>Subtotal:</p>
            <p className="font-bold">
              {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
            </p>
          </div>

          <Separator className="my-4" />

          <div className="mb-6 flex justify-between">
            <p className="text-lg font-semibold">Total:</p>
            <p className="text-lg font-bold">
              {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
            </p>
          </div>

          <Link to="/checkout" className={buttonVariants({ size: 'lg', className: 'mb-4 w-full' })}>
            Proceed to Checkout
          </Link>

          <Link to="/" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </Container>
  );
}
