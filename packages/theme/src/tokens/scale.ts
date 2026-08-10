import { REFERENCE_WIDTH, MIN_FONT_SIZE } from './reference';
import { spacing } from './spacing';
import { typography, type TypographyVariant, type TypeStyle } from './typography';
import { sizes } from './sizes';

/**
 * Width-responsive scaling.
 *
 * Every token is authored at REFERENCE_WIDTH (390dp). On a narrower device the
 * same dp value occupies proportionally more of the screen — a 360dp phone
 * renders the whole design ~8% larger relative to its screen, which reads as
 * "the text is too big and everything feels clustered" even though no single
 * value is wrong. This scales the token set to the actual viewport so the
 * design keeps its intended proportions on every phone.
 *
 * Clamped, not linear: below 0.88 text stops being comfortably legible, and
 * above 1.06 a big phone should show *more content*, not bigger content.
 */
export const SCALE_MIN = 0.88;
export const SCALE_MAX = 1.06;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The scale factor for a given viewport width. 1 at the reference width. */
export function scaleRatio(width: number): number {
  if (!width || !Number.isFinite(width)) return 1;
  return clamp(width / REFERENCE_WIDTH, SCALE_MIN, SCALE_MAX);
}

/** Round to a half-pixel — finer than 1dp matters at these sizes, but avoid long floats. */
const round = (n: number) => Math.round(n * 2) / 2;

function scaleType(style: TypeStyle, ratio: number): TypeStyle {
  return {
    ...style,
    // Never scale a label below the legibility floor, however narrow the device.
    fontSize: Math.max(MIN_FONT_SIZE - 1, round(style.fontSize * ratio)),
    lineHeight: round(style.lineHeight * ratio),
    letterSpacing:
      style.letterSpacing === undefined ? undefined : round(style.letterSpacing * ratio * 10) / 10,
  };
}

const mapValues = <T extends Record<string, number>>(obj: T, f: (n: number) => number): T =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)])) as T;

export type ScaledTokens = {
  ratio: number;
  spacing: typeof spacing;
  typography: typeof typography;
  sizes: typeof sizes;
};

/**
 * Scale the size-bearing tokens for a viewport. Radii are deliberately NOT
 * scaled: corner radii were shared literals across every Figma frame regardless
 * of canvas width, and a scaled radius reads as a different shape rather than a
 * smaller one.
 */
export function scaleTokens(width: number): ScaledTokens {
  const ratio = scaleRatio(width);

  if (ratio === 1) {
    return { ratio, spacing, typography, sizes };
  }

  return {
    ratio,
    spacing: mapValues(spacing, (n) => round(n * ratio)),
    typography: Object.fromEntries(
      Object.entries(typography).map(([k, v]) => [k, scaleType(v, ratio)]),
    ) as Record<TypographyVariant, TypeStyle>,
    sizes: {
      icon: mapValues(sizes.icon, (n) => Math.round(n * ratio)),
      circle: mapValues(sizes.circle, (n) => Math.round(n * ratio)),
      avatar: mapValues(sizes.avatar, (n) => Math.round(n * ratio)),
      // Tap targets never shrink below the accessibility floor.
      control: mapValues(sizes.control, (n) => Math.max(44, Math.round(n * ratio))),
    },
  };
}
