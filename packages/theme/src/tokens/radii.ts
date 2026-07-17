/** Corner radii (spec §10.5): 8 inputs · 12 cards · 16 sheets · full pills. */
export const radii = {
  none: 0,
  input: 8,
  button: 12,
  chip: 14,
  card: 16,
  cardLg: 18,
  sheet: 20,
  banner: 20,
  pill: 9999,
} as const;

export type RadiusKey = keyof typeof radii;
