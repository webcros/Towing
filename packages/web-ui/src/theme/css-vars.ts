import { darkTheme, lightTheme, type ColorTokens } from '@towing/theme/tokens';

/**
 * Per-console accent overrides layered on top of the shared mobile tokens.
 * Both web consoles reuse every semantic token from `@towing/theme`; only the
 * brand accent differs per realm (spec §10.3): TowFleet leans Fleet Navy,
 * the future Admin console leans Charcoal + Blue.
 */
export type RealmAccent = {
  light: Partial<ColorTokens>;
  dark: Partial<ColorTokens>;
};

/** TowFleet Web — Fleet Navy #1E3A8A (light) / #2747B0 (dark). */
export const fleetAccent: RealmAccent = {
  light: {
    brand: '#1E3A8A',
    brandPressed: '#172D6E',
    onBrand: '#FFFFFF',
    brandTint: '#E8EDFB',
    tabActive: '#1E3A8A',
  },
  dark: {
    brand: '#2747B0',
    brandPressed: '#1E3A8A',
    onBrand: '#FFFFFF',
    brandTint: '#1B2447',
    tabActive: '#2747B0',
  },
};

const toKebab = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function colorVarLines(colors: ColorTokens): string {
  return Object.entries(colors)
    .map(([key, value]) => `  --${toKebab(key)}: ${value};`)
    .join('\n');
}

/**
 * Renders the semantic tokens as CSS custom properties for both modes.
 * Dark mode uses the `class` strategy (`.dark` on <html>), matching the
 * Tailwind custom variant declared in styles/web-ui.css.
 */
export function themeCss(accent: RealmAccent): string {
  const light: ColorTokens = { ...lightTheme.colors, ...accent.light };
  const dark: ColorTokens = { ...darkTheme.colors, ...accent.dark };
  return `:root {\n${colorVarLines(light)}\n}\n.dark {\n${colorVarLines(dark)}\n}`;
}
