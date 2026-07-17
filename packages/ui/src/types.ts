import type React from 'react';

/**
 * Shape of an icon component (Lucide icons match this). Kept structural so the
 * UI kit never hard-depends on a specific icon library — callers pass icons in.
 */
export type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}>;
