import type { FontWeightKey } from '../types';

/** Mobile type scale (spec §10.4): 32/24/20/17/15/13/11. */
export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'body'
  | 'bodyMedium'
  | 'caption'
  | 'label'
  | 'micro';

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  weight: FontWeightKey;
  letterSpacing?: number;
  uppercase?: boolean;
};

export const typography: Record<TypographyVariant, TypeStyle> = {
  display: { fontSize: 34, lineHeight: 36, weight: 'bold', letterSpacing: -0.86 },
  h1: { fontSize: 28, lineHeight: 34, weight: 'bold', letterSpacing: -0.5 },
  h2: { fontSize: 24, lineHeight: 31, weight: 'bold', letterSpacing: -0.3 },
  h3: { fontSize: 20, lineHeight: 26, weight: 'semibold', letterSpacing: -0.2 },
  title: { fontSize: 17, lineHeight: 24, weight: 'semibold' },
  body: { fontSize: 15, lineHeight: 22, weight: 'regular' },
  bodyMedium: { fontSize: 15, lineHeight: 22, weight: 'medium' },
  caption: { fontSize: 13, lineHeight: 18, weight: 'regular' },
  label: { fontSize: 11, lineHeight: 16, weight: 'semibold', letterSpacing: 0.5, uppercase: true },
  micro: { fontSize: 11, lineHeight: 15, weight: 'regular' },
};
