/**
 * Brand-agnostic primitive color ramps (spec §10.3). Themes map these to
 * semantic tokens; components never import palette directly.
 */
export const palette = {
  white: '#FFFFFF',
  black: '#000000',

  /** Neutral ramp used for surfaces, borders and text in light mode. */
  neutral: {
    0: '#FFFFFF',
    25: '#FCFCFD',
    50: '#FAFAFA',
    100: '#F3F4F6',
    150: '#F9FAFB',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0E1116',
  },

  /** Dark-mode surface ramp (Charcoal/Slate, spec §10.3). */
  slate: {
    950: '#0E1116',
    900: '#15181F',
    800: '#1C212B',
    700: '#252B36',
    600: '#2E3542',
  },

  success: { light: '#22C55E', dark: '#34D399' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  error: { light: '#EF4444', dark: '#F87171' },
  /** Reserved strictly for SOS / critical safety (spec §10.3). */
  sos: '#DC2626',
} as const;
