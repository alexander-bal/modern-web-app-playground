import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { tsr } from '../lib/api-client';

const formatPrice = (price: string, currency: string) => {
  const numericPrice = Number.parseFloat(price);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(numericPrice);
};

export function CartSidebar() {
  const { data, isPending } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });

  const cart = data?.status === 200 ? data.body : null;

  return (
    <div className="sticky top-[88px] rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold">Your Cart</h2>

      {isPending ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-6" />
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <ShoppingCart className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your cart is empty</p>
        </div>
      ) : (
        <>
          <div className="mb-2 max-h-90 overflow-y-auto">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="line-clamp-2 text-sm">{item.productName}</p>
                  <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                </div>
                <p className="shrink-0 text-sm">{formatPrice(item.lineTotal, item.currency)}</p>
              </div>
            ))}
          </div>

          <Separator className="my-2" />

          <div className="mb-4 flex justify-between">
            <p className="text-sm font-bold">Subtotal</p>
            <p className="text-sm font-bold">
              {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
            </p>
          </div>

          <Link to="/checkout" className={buttonVariants({ className: 'mb-2 w-full' })}>
            Checkout
          </Link>
          <Link to="/cart" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
            View Cart
          </Link>
        </>
      )}
    </div>
  );
}
