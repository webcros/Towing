import { cn } from '../lib/cn';

/** §10.9: empty states are designed, not defaulted — friendly copy + a next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-text-tertiary">{icon}</div> : null}
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description ? <p className="max-w-sm text-sm text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
