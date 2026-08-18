import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import noPhoto from '../assets/no-photo.svg';
import { orpc } from '../lib/api-client';

const PAGE_SIZE = 20;

type SortOption = 'relevance' | 'price_asc' | 'price_desc';

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const sort = (searchParams.get('sort') || 'relevance') as SortOption;
  const page = Number(searchParams.get('page')) || 1;

  const validationError =
    query.trim().length > 0 && query.trim().length < 2
      ? 'Search query must be at least 2 characters'
      : null;

  const shouldFetch = query.trim().length >= 2;

  const { data, isPending, error } = useQuery(
    orpc.products.search.queryOptions({
      input: { q: query, sort, page, limit: PAGE_SIZE },
      enabled: shouldFetch,
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

  const handleSortChange = (newSort: SortOption) => {
    setSearchParams({ q: query, sort: newSort, page: '1' });
  };

  const handlePageChange = (value: number) => {
    setSearchParams({ q: query, sort, page: value.toString() });
  };

  if (!query) {
    return (
      <Container className="py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Search Products</h1>
        <Alert>
          <AlertDescription>Enter a search query to find products.</AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (validationError) {
    return (
      <Container className="py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Search Results</h1>
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      </Container>
    );
  }

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

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
  ];

  return (
    <Container className="py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Search results for: "{query}"</h1>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-muted-foreground">
          {pagination?.total || 0} {pagination?.total === 1 ? 'result' : 'results'} found
        </p>

        <div className="flex gap-1">
          {sortOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={sort === option.value ? 'default' : 'outline'}
              onClick={() => handleSortChange(option.value)}
              aria-pressed={sort === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <Alert>
          <AlertDescription>
            No products match your search. Try different keywords.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <div
                key={product.id}
                data-testid="product-card"
                className="flex min-h-85 flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <Link to={`/products/${product.slug}`} className="flex h-full flex-col">
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
                  <div className="flex grow flex-col overflow-hidden p-4">
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
                        const fraction = parts.find((p) => p.type === 'fraction')?.value ?? '00';
                        return (
                          <span
                            className={`inline-flex items-start font-bold ${
                              product.compareAtPrice ? 'text-destructive' : 'text-foreground'
                            }`}
                          >
                            <span className="mt-[0.1em] text-[0.8rem] opacity-70">{symbol}</span>
                            <span className="text-2xl leading-none">{integer}</span>
                            <span className="mt-[0.1em] text-[0.8rem] opacity-70">{fraction}</span>
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
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                data-testid="pagination"
                count={pagination.totalPages}
                page={page}
                onChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </Container>
  );
}
