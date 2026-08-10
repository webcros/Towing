import type { FontWeightKey } from '../types';

/**
 * Mobile type scale, resolved at the 390dp reference width (see `reference.ts`).
 *
 * Derived from the Figma source rather than the spec: the working band 11→20
 * runs on a major second (1.125), deliberately low contrast because hierarchy
 * in a dense list UI is carried by weight and colour, not size. The one large
 * jump is `title` 18 → `display` 40 — raise the floor, raise the ceiling,
 * delete the middle. `caption` 13 is the single off-scale half-step, kept so
 * regular-weight secondary text has somewhere to sit without landing on the
 * semibold `label`.
 *
 * Line heights follow the wrap rule: text that structurally cannot wrap runs
 * tight (~1.2–1.25), text that does wrap stays loose (~1.4) for readability.
 * The Figma's Inter "auto" leading is ~1.21 throughout, which is a default
 * rather than a decision — matching it on `body` would hurt addresses and notes.
 *
 * 10 is the legibility floor. The Figma breaches it in four places (stat
 * labels 9, chart labels 8.3, Services banner 7.8, driver contact rows 8.3–9.5);
 * every one is deliberately overridden upward at the call site.
 */
export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyMedium'
  | 'caption'
  | 'label'
  | 'overline'
  | 'micro';

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  weight: FontWeightKey;
  letterSpacing?: number;
  uppercase?: boolean;
};

export const typography: Record<TypographyVariant, TypeStyle> = {
  // Tight — single-line by construction.
  display: { fontSize: 40, lineHeight: 48, weight: 'bold', letterSpacing: -1 },
  h1: { fontSize: 30, lineHeight: 36, weight: 'bold', letterSpacing: -0.75 },
  h2: { fontSize: 24, lineHeight: 30, weight: 'bold', letterSpacing: -0.3 },
  h3: { fontSize: 20, lineHeight: 26, weight: 'semibold', letterSpacing: -0.2 },
  title: { fontSize: 18, lineHeight: 24, weight: 'semibold', letterSpacing: -0.2 },
  subtitle: { fontSize: 16, lineHeight: 22, weight: 'semibold' },

  // Loose — wraps.
  body: { fontSize: 14, lineHeight: 20, weight: 'regular' },
  bodyMedium: { fontSize: 14, lineHeight: 20, weight: 'medium' },
  caption: { fontSize: 13, lineHeight: 18, weight: 'regular' },

  // Tight — labels and micro-copy.
  label: { fontSize: 12, lineHeight: 16, weight: 'semibold', letterSpacing: 0.2 },
  overline: { fontSize: 11, lineHeight: 14, weight: 'bold', letterSpacing: 0.6, uppercase: true },
  micro: { fontSize: 10, lineHeight: 14, weight: 'regular' },
};
