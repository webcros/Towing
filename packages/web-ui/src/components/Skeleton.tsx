import { cn } from '../lib/cn';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-input bg-skeleton-base', className)} {...props} />;
}
