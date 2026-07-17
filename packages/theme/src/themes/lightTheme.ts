import { brandConfig } from '../brand.config';
import { palette } from '../tokens/palette';
import { spacing } from '../tokens/spacing';
import { radii } from '../tokens/radii';
import { typography } from '../tokens/typography';
import { lightShadows } from '../tokens/shadows';
import type { Theme } from '../types';

export const lightTheme: Theme = {
  mode: 'light',
  isDark: false,
  colors: {
    brand: brandConfig.brand.default,
    brandPressed: brandConfig.brand.pressed,
    onBrand: brandConfig.brand.onBrand,
    brandTint: brandConfig.brand.tint,

    surface0: palette.neutral[50],
    surface1: palette.neutral[100],
    card: palette.white,
    border: palette.neutral[100],
    borderSubtle: palette.neutral[150],
    borderStrong: palette.neutral[300],
    divider: palette.neutral[100],
    overlay: 'rgba(17,24,39,0.45)',
    mapBg: '#EEF1F5',

    textPrimary: palette.neutral[900],
    textSecondary: palette.neutral[500],
    textTertiary: palette.neutral[400],
    textInverse: palette.white,

    success: palette.success.light,
    warning: palette.warning.light,
    error: palette.error.light,
    info: '#3B82F6',
    sos: palette.sos,

    successSoftBg: '#EBF5EC',
    successSoftFg: '#228336',
    warningSoftBg: '#FEF3E2',
    warningSoftFg: '#B45309',
    errorSoftBg: '#FEECEC',
    errorSoftFg: '#C0392B',
    infoSoftBg: '#E7F0FF',
    infoSoftFg: '#1D4ED8',

    star: brandConfig.brand.default,
    skeletonBase: palette.neutral[100],
    skeletonHighlight: palette.neutral[150],
    fabBg: palette.white,
    tabBarBg: palette.white,
    tabActive: brandConfig.brand.default,
    tabInactive: palette.neutral[800],
  },
  spacing,
  radii,
  typography,
  fonts: brandConfig.fonts,
  shadows: lightShadows,
};
