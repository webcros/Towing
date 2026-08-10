import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface1 text-text-secondary',
        brand: 'bg-brand-tint text-brand',
        success: 'bg-success-soft-bg text-success-soft-fg',
        warning: 'bg-warning-soft-bg text-warning-soft-fg',
        error: 'bg-error-soft-bg text-error-soft-fg',
        info: 'bg-info-soft-bg text-info-soft-fg',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
