import { cn } from '../lib/cn';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-input border border-border-strong bg-card px-3 text-sm text-text-primary',
        'placeholder:text-text-tertiary',
        'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-error',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-xs font-semibold text-text-secondary uppercase tracking-wide', className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}
