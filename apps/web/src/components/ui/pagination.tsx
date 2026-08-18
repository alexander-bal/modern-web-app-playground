import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Fragment } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps extends Omit<React.ComponentProps<'nav'>, 'onChange'> {
  page: number;
  count: number;
  onChange: (page: number) => void;
}

/** Page numbers around the current page, always including the first and last. */
function pageItems(page: number, count: number): { page: number; gapBefore: boolean }[] {
  const wanted = new Set([1, count, page, page - 1, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);

  return pages.map((p, i) => ({ page: p, gapBefore: i > 0 && p - pages[i - 1] > 1 }));
}

function Pagination({ page, count, onChange, className, ...props }: PaginationProps) {
  if (count <= 1) return null;

  const step = (target: number, label: string, icon: React.ReactNode, disabled: boolean) => (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(target)}
    >
      {icon}
    </Button>
  );

  return (
    <nav aria-label="pagination" className={cn('flex items-center gap-1', className)} {...props}>
      {step(1, 'Go to first page', <ChevronsLeft />, page <= 1)}
      {step(page - 1, 'Go to previous page', <ChevronLeft />, page <= 1)}

      {pageItems(page, count).map((item) => (
        <Fragment key={item.page}>
          {item.gapBefore && (
            <span aria-hidden className="px-2 text-muted-foreground">
              &hellip;
            </span>
          )}
          <Button
            size="icon-sm"
            variant={item.page === page ? 'default' : 'ghost'}
            aria-label={`Go to page ${item.page}`}
            aria-current={item.page === page ? 'page' : undefined}
            onClick={() => onChange(item.page)}
          >
            {item.page}
          </Button>
        </Fragment>
      ))}

      {step(page + 1, 'Go to next page', <ChevronRight />, page >= count)}
      {step(count, 'Go to last page', <ChevronsRight />, page >= count)}
    </nav>
  );
}

export { Pagination };
