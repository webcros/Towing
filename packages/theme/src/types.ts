import { spacing } from './tokens/spacing';
import { radii } from './tokens/radii';
import { typography } from './tokens/typography';

export type ThemeMode = 'light' | 'dark';

export type FontWeightKey = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * Semantic color tokens — the ONLY color surface components are allowed to
 * touch. Each theme maps primitives (palette + brand) onto these roles.
 */
export type ColorTokens = {
  // Brand
  brand: string;
  brandPressed: string;
  onBrand: string;
  brandTint: string;

  // Surfaces
  surface0: string; // page background
  surface1: string; // grouped / subtle background
  card: string;
  border: string;
  borderSubtle: string;
  borderStrong: string;
  divider: string;
  overlay: string;
  mapBg: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;
  sos: string;

  // Soft status pills (badge bg + fg)
  successSoftBg: string;
  successSoftFg: string;
  warningSoftBg: string;
  warningSoftFg: string;
  errorSoftBg: string;
  errorSoftFg: string;
  infoSoftBg: string;
  infoSoftFg: string;

  // Accents / misc
  star: string;
  skeletonBase: string;
  skeletonHighlight: string;
  fabBg: string;
  tabBarBg: string;
  tabActive: string;
  tabInactive: string;
};

export type Shadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export type Theme = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  fonts: Record<FontWeightKey, string>;
  shadows: {
    card: Shadow;
    fab: Shadow;
    raised: Shadow;
  };
};
