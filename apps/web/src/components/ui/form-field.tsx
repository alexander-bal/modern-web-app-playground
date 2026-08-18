import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  id: string;
  label: string;
  error?: string | undefined;
}

/** Labelled text input; wires `aria-invalid` and `aria-describedby` when `error` is set. */
function FormField({ id, label, error, className, ...props }: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={cn('grid w-full gap-2', className)}>
      <div className="flex items-center gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {props.required && !props.disabled && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </div>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
