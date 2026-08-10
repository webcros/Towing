'use client';

import { cn } from '../lib/cn';

/**
 * A controlled on/off switch.
 *
 * The settings page hand-rolled one of these in Phase 2 (`<button role="switch">`
 * plus two nested spans), and Phase 7 gives that page a save button — which
 * means the toggles now need real controlled state and a real disabled state
 * while a save is in flight. Extracting it was the smallest possible
 * addition to `web-ui` that removes a duplicated a11y pattern.
 *
 * `role="switch"` with `aria-checked` rather than a styled checkbox: screen
 * readers announce "on/off" instead of "checked", which is what a preference
 * toggle actually means.
 */
export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Element id of the visible label, for `aria-labelledby`. */
  labelledBy?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  labelledBy,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-brand' : 'bg-border-strong',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
