import { cn } from '@/lib/utils';

interface CountBadgeProps extends React.ComponentProps<'span'> {
  count: number;
  children: React.ReactNode;
}

/** Wraps an element with a count bubble anchored to its top-right corner. */
function CountBadge({ count, children, className, ...props }: CountBadgeProps) {
  return (
    <span className={cn('relative inline-flex', className)} {...props}>
      {children}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] font-bold text-white tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
}

export { CountBadge };
