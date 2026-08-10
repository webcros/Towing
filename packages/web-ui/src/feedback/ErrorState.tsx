import { Button } from '../components/Button';
import { cn } from '../lib/cn';

/** §10.9: human copy + exactly one recovery action; never raw error codes. */
export function ErrorState({
  title = "Couldn't load this",
  description = 'Something went wrong on our side. Please try again.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-card border border-error-soft-bg bg-error-soft-bg/40 px-6 py-12 text-center',
        className,
      )}
    >
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="max-w-sm text-sm text-text-secondary">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
