import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import noPhoto from '../assets/no-photo.svg';
import { orpc } from '../lib/api-client';
import { parseAddress } from '../lib/parse-address';

type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'fulfilled'
  | 'paid'
  | 'cancelled'
  | 'cart';

export function OrdersPage() {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const {
    data,
    isPending,
    error: queryError,
    refetch,
  } = useQuery(orpc.orders.listMyOrders.queryOptions());

  const orders = data?.orders ?? [];
  const error = queryError instanceof Error ? queryError.message : null;

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

  const getStatusVariant = (status: OrderStatus): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'confirmed':
      case 'shipped':
      case 'fulfilled':
      case 'paid':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
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

  if (error) {
    return (
      <Container>
        <div className="mt-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      </Container>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Container className="py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">My Orders</h1>
        <div className="mt-8 text-center">
          <h2 className="mb-2 text-xl font-semibold">You haven't placed any orders yet</h2>
          <Link to="/" className={buttonVariants({ className: 'mt-4' })}>
            Browse Products
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">My Orders</h1>

      <Accordion
        multiple={false}
        value={expandedOrderId ? [expandedOrderId] : []}
        onValueChange={(value) => setExpandedOrderId((value[0] as string | undefined) ?? null)}
      >
        {orders.map((order) => {
          const shippingAddress = parseAddress(order.shippingAddress);

          return (
            <AccordionItem
              key={order.id}
              value={order.id}
              className="mb-4 rounded-xl border bg-card px-6 shadow-sm"
            >
              <AccordionTrigger data-testid="order-accordion-trigger">
                <div className="flex w-full items-center justify-between pr-4">
                  <div className="text-left">
                    <span className="block text-lg font-semibold">Order {order.orderNumber}</span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      {formatDate(order.orderDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold">
                      {formatPrice(order.totalAmount, order.currency)}
                    </span>
                    <Badge variant={getStatusVariant(order.status as OrderStatus)}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Order Items
                </h3>

                {order.items.length === 0 ? (
                  <p className="mb-4 text-sm">No items found for this order.</p>
                ) : (
                  order.items.map((item) => (
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
                        <p className="self-center font-bold">
                          {formatPrice(item.lineTotal, item.currency)}
                        </p>
                      </div>
                    </div>
                  ))
                )}

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

                {order.discountAmount && Number.parseFloat(order.discountAmount) > 0 && (
                  <div className="mb-2 flex justify-between">
                    <p className="text-sm text-muted-foreground">Discount:</p>
                    <p className="text-sm text-muted-foreground">
                      -{formatPrice(order.discountAmount, order.currency)}
                    </p>
                  </div>
                )}

                <Separator className="my-4" />

                <div className="mb-6 flex justify-between">
                  <p className="text-lg font-semibold">Total:</p>
                  <p className="text-lg font-bold">
                    {formatPrice(order.totalAmount, order.currency)}
                  </p>
                </div>

                {shippingAddress && (
                  <>
                    <Separator className="my-4" />
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
                      {shippingAddress.state && `, ${shippingAddress.state}`}{' '}
                      {shippingAddress.postalCode}
                    </p>
                    <p className="text-sm">{shippingAddress.countryCode}</p>
                    {shippingAddress.phone && <p className="text-sm">{shippingAddress.phone}</p>}
                  </>
                )}

                {order.paymentTransactionId && (
                  <>
                    <Separator className="my-4" />
                    <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Payment
                    </h3>
                    <p className="text-sm">Transaction ID: {order.paymentTransactionId}</p>
                  </>
                )}

                {order.expectedDeliveryDate && (
                  <>
                    <Separator className="my-4" />
                    <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Timeline
                    </h3>
                    <p className="text-sm">
                      Expected Delivery: {formatDate(order.expectedDeliveryDate)}
                    </p>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Container>
  );
}
