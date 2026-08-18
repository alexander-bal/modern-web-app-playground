import { cn } from '@/lib/utils';

function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4', className)} {...props} />;
}

export { Container };
