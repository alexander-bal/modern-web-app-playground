import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import noPhoto from '../assets/no-photo.svg';
import { CartSidebar } from '../components/cart-sidebar';
import { ProductCardCartControls } from '../components/product-card-cart-controls';
import { orpc } from '../lib/api-client';

const PAGE_SIZE = 20;

export function ProductsPage() {
  const [page, setPage] = useState(1);

  const { data, isPending, error } = useQuery(
    orpc.products.list.queryOptions({
      input: { status: 'active', page, limit: PAGE_SIZE },
    })
  );

  const products = data?.products ?? [];
  const pagination = data?.pagination ?? null;

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
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

  if (error) {
    return (
      <Container>
        <div className="mt-8">
          <Alert variant="destructive">
            <AlertDescription>
              {error instanceof Error ? error.message : 'An error occurred'}
            </AlertDescription>
          </Alert>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          {products.length === 0 ? (
            <p className="text-muted-foreground">No products available at the moment.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    data-testid="product-card"
                    className="flex min-h-85 flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                  >
                    <Link to={`/products/${product.slug}`} className="flex flex-col">
                      <div className="relative">
                        <img
                          src={product.imageUrl ?? noPhoto}
                          alt={product.name}
                          className={`h-50 w-full shrink-0 bg-muted ${
                            product.imageUrl ? 'object-cover' : 'object-none'
                          }`}
                        />
                        {product.compareAtPrice && (
                          <span className="pointer-events-none absolute top-2 right-2 rounded bg-destructive px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                            {`−${Math.round((1 - Number.parseFloat(product.price) / Number.parseFloat(product.compareAtPrice)) * 100)}%`}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden p-4">
                        <h2 className="mb-1 line-clamp-2 text-base leading-tight font-semibold">
                          {product.name}
                        </h2>

                        {product.shortDescription && (
                          <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                            {product.shortDescription}
                          </p>
                        )}

                        <div className="mt-auto">
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
                            const fraction =
                              parts.find((p) => p.type === 'fraction')?.value ?? '00';
                            return (
                              <span
                                className={`inline-flex items-start font-bold ${
                                  product.compareAtPrice ? 'text-destructive' : 'text-foreground'
                                }`}
                              >
                                <span className="mt-[0.1em] text-[0.8rem] opacity-70">
                                  {symbol}
                                </span>
                                <span className="text-2xl leading-none">{integer}</span>
                                <span className="mt-[0.1em] text-[0.8rem] opacity-70">
                                  {fraction}
                                </span>
                              </span>
                            );
                          })()}
                          {product.compareAtPrice && (
                            <span className="mt-0.5 block text-xs text-muted-foreground line-through">
                              {formatPrice(product.compareAtPrice, product.currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    <div className="px-4 pb-4">
                      <ProductCardCartControls productId={product.id} productName={product.name} />
                    </div>
                  </div>
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <Pagination
                    data-testid="pagination"
                    count={pagination.totalPages}
                    page={page}
                    onChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <div className="hidden w-75 shrink-0 lg:block">
          <CartSidebar />
        </div>
      </div>
    </Container>
  );
}
