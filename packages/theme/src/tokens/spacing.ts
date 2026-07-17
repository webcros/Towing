/** Spacing scale (spec §10.5): 4·8·12·16·20·24·32, base unit 4px. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export type SpacingKey = keyof typeof spacing;

/** Arbitrary multiples of the 4px base unit, e.g. sp(9) === 36. */
export const sp = (multiplier: number): number => multiplier * 4;
