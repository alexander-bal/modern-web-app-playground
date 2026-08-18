import { Loader2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

// The Playwright suites locate loading states via getByRole('progressbar').
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="progressbar"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
