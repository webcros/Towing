/**
 * ★ THE SINGLE BRAND SWAP POINT ★
 *
 * The whole app's brand identity (primary color + fonts) is defined here and
 * nowhere else. Flip these values to re-skin every screen — no component edits.
 *
 * Current brand: TowGo — Figma amber (#FFB800) + Inter.
 *
 * WCAG note: amber #FFB800 does NOT pass AA contrast with white text, so
 * `onBrand` (the text/icon color that sits ON a brand-colored fill) is dark
 * ink, not white. If you swap to a dark primary (e.g. spec Signal Blue
 * #2563EB), set `onBrand` back to '#FFFFFF'.
 */
export const brandConfig = {
  brand: {
    /** Soft brand tint — safety banner / subtle brand surfaces. */
    tint: '#FFF9EA',
    /** Primary brand color — CTAs, active states, accents. */
    default: '#FFB800',
    /** Pressed/active state of the primary. */
    pressed: '#E6A600',
    /** Text/icon color placed on top of a brand fill. */
    onBrand: '#111827',
  },
  /**
   * Font family names, keyed by weight. These strings must match the keys the
   * app registers with expo-font (see @expo-google-fonts/inter export names).
   */
  fonts: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
} as const;

export type BrandConfig = typeof brandConfig;
