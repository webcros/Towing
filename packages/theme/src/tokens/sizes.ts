/**
 * Non-typographic sizes at the 390dp reference width (see `reference.ts`).
 *
 * These previously did not exist, so every icon size, circle diameter and
 * control height was a hardcoded literal — which is how the icon-circle family
 * drifted to 36/40/44/48/56 when the design only ever uses 36/40/44/48.
 */

/** Glyph sizes for inline and contained icons. */
export const iconSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

/** Diameters for the circular icon chips used in stat rows and list rows. */
export const iconCircles = {
  sm: 36,
  md: 40,
  lg: 44,
  xl: 48,
} as const;

/** Avatar diameters. `xl` is the driver profile hero. */
export const avatars = {
  sm: 40,
  md: 56,
  lg: 64,
  xl: 85,
} as const;

/** Control heights. `tapTarget` is the accessibility floor, not a visual size. */
export const controlHeights = {
  tapTarget: 44,
  row: 44,
  button: 48,
  buttonLg: 52,
  appBar: 56,
} as const;

export const sizes = {
  icon: iconSizes,
  circle: iconCircles,
  avatar: avatars,
  control: controlHeights,
} as const;

export type IconSizeKey = keyof typeof iconSizes;
export type IconCircleKey = keyof typeof iconCircles;
export type AvatarKey = keyof typeof avatars;
export type ControlHeightKey = keyof typeof controlHeights;
