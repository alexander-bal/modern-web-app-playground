import { ArrowLeft, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Spinner } from '@/components/ui/spinner';
import noPhoto from '../assets/no-photo.svg';
import { CartSidebar } from '../components/cart-sidebar';
import { tsr } from '../lib/api-client';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);

  const {
    data,
    isPending,
    error: queryError,
  } = tsr.products.getBySlug.useQuery({
    queryKey: ['products', slug],
    queryData: {
      params: { slug: slug ?? '' },
    },
    enabled: !!slug,
  });

  const product = data?.status === 200 ? data.body : null;
  const error = !slug
    ? 'Product slug is missing'
    : queryError instanceof Error
      ? queryError.message
      : queryError
        ? queryError.status === 404
          ? 'Product not found'
          : 'Failed to fetch product'
        : null;

  const addToCartMutation = tsr.cart.addItem.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Added to cart!');
      setQuantity(1);
    },
  });

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const addToCart = () => {
    if (!product) return;

    addToCartMutation.mutate({
      body: {
        productId: product.id,
        quantity,
      },
    });
  };

  if (isPending) {
    return (
      <Container>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-10" />
        </div>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container>
        <div className="mt-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft />
            Back
          </Button>
          <Alert variant="destructive">
            <AlertDescription>{error || 'Product not found'}</AlertDescription>
          </Alert>
          {addToCartMutation.error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                {addToCartMutation.error instanceof Error
                  ? addToCartMutation.error.message
                  : 'Failed to add to cart'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft />
            Back
          </Button>

          {addToCartMutation.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {addToCartMutation.error instanceof Error
                  ? addToCartMutation.error.message
                  : 'Failed to add to cart'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-8 md:flex-row">
            <div className="md:w-1/2 md:shrink-0">
              <img
                src={product.imageUrl ?? noPhoto}
                alt={product.name}
                className={`max-h-125 w-full rounded-xl border bg-muted ${
                  product.imageUrl ? 'object-cover' : 'object-none'
                }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="mb-2 text-2xl font-semibold tracking-tight">{product.name}</h1>

              {product.category && (
                <p className="mb-4 text-sm text-muted-foreground">Category: {product.category}</p>
              )}

              {product.tags && product.tags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mb-6 flex flex-wrap items-baseline gap-3">
                {(() => {
                  const numericPrice = Number.parseFloat(product.price);
                  const parts = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: product.currency,
                  }).formatToParts(numericPrice);
                  const symbol = parts.find((p) => p.type === 'currency')?.value ?? '';
                  const integer = parts
                    .filter((p) => p.type === 'integer' || p.type === 'group')
                    .map((p) => p.value)
                    .join('');
                  const fraction = parts.find((p) => p.type === 'fraction')?.value ?? '00';
                  return (
                    <span className="inline-flex items-start font-bold">
                      <span className="mt-[0.15em] text-base text-muted-foreground">{symbol}</span>
                      <span className="text-4xl leading-none">{integer}</span>
                      <span className="mt-[0.15em] text-base text-muted-foreground">
                        {fraction}
                      </span>
                    </span>
                  );
                })()}
                {product.compareAtPrice && (
                  <p className="text-muted-foreground">
                    Recommended:{' '}
                    <span className="line-through">
                      {formatPrice(product.compareAtPrice, product.currency)}
                    </span>
                  </p>
                )}
              </div>

              <div className="mb-6 rounded-xl bg-muted p-6">
                <p className="mb-2 text-sm text-muted-foreground">Quantity</p>
                <div className="mb-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    data-testid="decrease-quantity"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={quantity <= 1 || addToCartMutation.isPending}
                  >
                    <Minus />
                  </Button>
                  <span data-testid="quantity-input" className="min-w-10 text-center">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    data-testid="increase-quantity"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((prev) => prev + 1)}
                    disabled={addToCartMutation.isPending}
                  >
                    <Plus />
                  </Button>
                </div>

                <Button
                  size="lg"
                  onClick={() => addToCart()}
                  disabled={addToCartMutation.isPending}
                  className="w-full"
                  data-testid="add-to-cart-button"
                >
                  <ShoppingCart />
                  {addToCartMutation.isPending ? 'Adding...' : 'Add to Cart'}
                </Button>
              </div>

              {product.description && (
                <div>
                  <h2 className="mb-2 text-lg font-semibold">Description</h2>
                  <p className="whitespace-pre-line text-muted-foreground">{product.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="hidden w-75 shrink-0 lg:block">
          <CartSidebar />
        </div>
      </div>
    </Container>
  );
}
