import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { Toaster } from '@/components/ui/sonner';
import { CartProvider } from './contexts/cart-context';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  if (import.meta.env.VITE_API_MOCKING === 'enabled') {
    const { initMocks } = await import('./mocks/init');
    await initMocks();
  }

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <RouterProvider router={router} />
          <Toaster />
        </CartProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

void bootstrap();
