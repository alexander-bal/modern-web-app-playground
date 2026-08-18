import { CircleUser, Search, ShoppingCart } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { CountBadge } from '@/components/ui/count-badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '../contexts/auth-context';
import { useCart } from '../contexts/cart-context';

export function RootLayout() {
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('q')?.toString().trim();
    if (query && query.length >= 2) {
      navigate(`/search?q=${encodeURIComponent(query)}&sort=relevance`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl">
        <Container>
          <div className="flex h-18 items-center gap-6">
            <Link
              to="/"
              className="shrink-0 text-xl font-extrabold tracking-tight transition-opacity hover:opacity-80"
            >
              Mercado
            </Link>

            <form onSubmit={handleSearchSubmit} className="max-w-120 flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="rounded-full pl-8"
                />
              </div>
            </form>

            <div className="ml-auto flex items-center gap-2">
              {user ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-1">
                    <CircleUser className="size-5 text-primary" />
                    <span className="text-sm font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                  <Link
                    to="/account/addresses"
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    Address Book
                  </Link>
                  <Link to="/orders" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    My Orders
                  </Link>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <Link to="/login" className={buttonVariants({ size: 'sm' })}>
                  Sign in
                </Link>
              )}

              <Link
                to="/cart"
                aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'icon',
                  className: 'text-primary',
                })}
              >
                <CountBadge count={itemCount}>
                  <ShoppingCart />
                </CountBadge>
              </Link>
            </div>
          </div>
        </Container>
      </header>

      <Container className="py-8">
        <Outlet />
      </Container>
    </div>
  );
}
