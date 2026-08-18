import { CircleCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';
import { parseAddress } from '../lib/parse-address';

export function OrderConfirmationPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();

  const {
    data,
    isPending,
    error: queryError,
  } = tsr.orders.getByOrderNumber.useQuery({
    queryKey: ['orders', orderNumber],
    queryData: {
      params: { orderNumber: orderNumber ?? '' },
    },
    enabled: !!orderNumber,
  });

  const order = data?.status === 200 ? data.body : null;
  const shippingAddress = parseAddress(order?.shippingAddress);
  const billingAddress = parseAddress(order?.billingAddress);
  const error = !orderNumber
    ? 'Order number is missing'
    : queryError instanceof Error
      ? queryError.message
      : queryError
        ? queryError.status === 404
          ? 'Order not found'
          : 'Failed to fetch order'
        : null;

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  if (error || !order) {
    return (
      <Container>
        <div className="mt-8">
          <Alert variant="destructive">
            <AlertDescription>{error || 'Order not found'}</AlertDescription>
          </Alert>
          <Link to="/" className={buttonVariants({ className: 'mt-4' })}>
            Continue Shopping
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-muted">
          <CircleCheck className="size-20 text-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Order Confirmed!</h1>
        <p className="text-muted-foreground">
          Thank you for your order. We've received your order and will process it shortly.
        </p>
      </div>

      <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Order {order.orderNumber}</h2>
            <p className="text-sm text-muted-foreground">Placed on {formatDate(order.orderDate)}</p>
          </div>
          <Badge>{order.status}</Badge>
        </div>

        <Separator className="my-4" />

        <div className="mb-6 flex flex-col gap-6 md:flex-row">
          {shippingAddress && (
            <div className="flex-1">
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Shipping Address
              </h3>
              <p className="text-sm">{shippingAddress.fullName}</p>
              <p className="text-sm">{shippingAddress.addressLine1}</p>
              {shippingAddress.addressLine2 && (
                <p className="text-sm">{shippingAddress.addressLine2}</p>
              )}
              <p className="text-sm">
                {shippingAddress.city}
                {shippingAddress.state && `, ${shippingAddress.state}`} {shippingAddress.postalCode}
              </p>
              <p className="text-sm">{shippingAddress.countryCode}</p>
              {shippingAddress.phone && <p className="text-sm">{shippingAddress.phone}</p>}
            </div>
          )}

          {billingAddress && (
            <div className="flex-1">
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Billing Address
              </h3>
              <p className="text-sm">{billingAddress.fullName}</p>
              <p className="text-sm">{billingAddress.addressLine1}</p>
              {billingAddress.addressLine2 && (
                <p className="text-sm">{billingAddress.addressLine2}</p>
              )}
              <p className="text-sm">
                {billingAddress.city}
                {billingAddress.state && `, ${billingAddress.state}`} {billingAddress.postalCode}
              </p>
              <p className="text-sm">{billingAddress.countryCode}</p>
              {billingAddress.phone && <p className="text-sm">{billingAddress.phone}</p>}
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Order Items
        </h3>

        {order.items.map((item) => (
          <div key={item.id} className="mb-2 rounded-lg border p-4">
            <div className="flex gap-4">
              <img
                src={item.productImageUrl ?? noPhoto}
                alt={item.productName}
                className={`size-15 shrink-0 rounded bg-muted ${
                  item.productImageUrl ? 'object-cover' : 'object-none'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p>{item.productName}</p>
                <p className="text-sm text-muted-foreground">SKU: {item.productSku}</p>
                <p className="text-sm">
                  Quantity: {item.quantity} × {formatPrice(item.unitPrice, item.currency)}
                </p>
              </div>
              <p className="self-center font-bold">{formatPrice(item.lineTotal, item.currency)}</p>
            </div>
          </div>
        ))}

        <Separator className="my-4" />

        <div className="mb-2 flex justify-between">
          <p>Subtotal:</p>
          <p>{formatPrice(order.subtotal, order.currency)}</p>
        </div>

        <div className="mb-2 flex justify-between">
          <p className="text-sm text-muted-foreground">Tax:</p>
          <p className="text-sm text-muted-foreground">
            {formatPrice(order.taxAmount, order.currency)}
          </p>
        </div>

        <div className="mb-2 flex justify-between">
          <p className="text-sm text-muted-foreground">Shipping:</p>
          <p className="text-sm text-muted-foreground">
            {formatPrice(order.shippingAmount, order.currency)}
          </p>
        </div>

        <Separator className="my-4" />

        <div className="mb-6 flex justify-between">
          <p className="text-lg font-semibold">Total:</p>
          <p className="text-lg font-bold">{formatPrice(order.totalAmount, order.currency)}</p>
        </div>

        <Link to="/" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
          Continue Shopping
        </Link>
      </div>
    </Container>
  );
}
