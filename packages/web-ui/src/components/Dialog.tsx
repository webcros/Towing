'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../lib/cn';

/**
 * A modal dialog built on the native `<dialog>` element.
 *
 * `showModal()` gives focus trapping, Escape-to-close, the backdrop, and
 * `inert`ness of the rest of the page — all of it, correctly, from the
 * platform, with **no new runtime dependency**. This package ships almost none
 * today and a money-confirmation modal is precisely where accessibility has to
 * be right rather than approximated.
 *
 * It lives here rather than in the app because it is the third hand-rolled
 * overlay in this codebase (`ComplianceDrawer`, `BulkImportDrawer` — whose own
 * comment says "web-ui has no Drawer" — and now this).
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name; wired to `aria-labelledby`. */
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, labelledBy, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // `showModal()` throws if the dialog is already open, and `open` may be
    // toggled by a parent re-render that did not actually change it.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // `close` fires for Escape and for form-method=dialog submits alike, so
      // one listener keeps React state in step with the platform's.
      onClose={onClose}
      // A click that lands on the <dialog> itself (rather than on its content
      // wrapper) is a backdrop click.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'w-[min(32rem,calc(100vw-2rem))] rounded-card border border-border bg-card p-0 text-text-primary shadow-xl',
        'backdrop:bg-black/50',
        className,
      )}
    >
      <div className="p-5">{children}</div>
    </dialog>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-4 space-y-1', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-base font-semibold', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-text-secondary', className)} {...props} />;
}

export function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('space-y-4 text-sm', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-5 flex justify-end gap-2', className)} {...props} />;
}
