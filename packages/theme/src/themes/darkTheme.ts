import { brandConfig } from '../brand.config';
import { palette } from '../tokens/palette';
import { spacing } from '../tokens/spacing';
import { radii } from '../tokens/radii';
import { typography } from '../tokens/typography';
import { darkShadows } from '../tokens/shadows';
import type { Theme } from '../types';

export const darkTheme: Theme = {
  mode: 'dark',
  isDark: true,
  colors: {
    brand: brandConfig.brand.default,
    brandPressed: brandConfig.brand.pressed,
    // Amber is light, so dark ink stays the correct on-brand text in both modes.
    onBrand: brandConfig.brand.onBrand,
    brandTint: 'rgba(255,184,0,0.12)',

    surface0: palette.slate[900],
    surface1: palette.slate[800],
    card: palette.slate[800],
    border: palette.slate[700],
    borderSubtle: palette.slate[700],
    borderStrong: palette.slate[600],
    divider: palette.slate[700],
    overlay: 'rgba(0,0,0,0.6)',
    mapBg: palette.slate[700],

    textPrimary: palette.neutral[100],
    textSecondary: palette.neutral[400],
    textTertiary: palette.neutral[500],
    textInverse: palette.neutral[900],

    success: palette.success.dark,
    warning: palette.warning.dark,
    error: palette.error.dark,
    info: '#60A5FA',
    sos: palette.sos,

    successSoftBg: 'rgba(52,199,89,0.15)',
    successSoftFg: '#4ADE80',
    warningSoftBg: 'rgba(245,158,11,0.15)',
    warningSoftFg: '#FBBF24',
    errorSoftBg: 'rgba(239,68,68,0.15)',
    errorSoftFg: '#F87171',
    infoSoftBg: 'rgba(59,130,246,0.15)',
    infoSoftFg: '#93C5FD',

    star: brandConfig.brand.default,
    skeletonBase: palette.slate[700],
    skeletonHighlight: palette.slate[600],
    fabBg: palette.slate[700],
    tabBarBg: palette.slate[800],
    tabActive: brandConfig.brand.default,
    tabInactive: palette.neutral[400],
  },
  spacing,
  radii,
  typography,
  fonts: brandConfig.fonts,
  shadows: darkShadows,
};
