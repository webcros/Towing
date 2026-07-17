// Shared flat ESLint config for every Towing package and app.
// Built on Expo's config (handles RN globals, Metro, TS, JSX) plus a
// hard rule that keeps raw color literals out of components — colors must
// come from the design-system theme (see @towing/theme).
const expoConfig = require('eslint-config-expo/flat');

/**
 * @param {object} [opts]
 * @param {boolean} [opts.enforceThemeColors] Ban hex/rgb color literals (for UI/feature code).
 */
function towingConfig({ enforceThemeColors = false } = {}) {
  /** @type {import('eslint').Linter.Config[]} */
  const config = [
    ...expoConfig,
    {
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'import/order': 'off',
      },
    },
    { ignores: ['node_modules/**', 'dist/**', '.expo/**', 'babel.config.js', 'metro.config.js'] },
  ];

  if (enforceThemeColors) {
    config.push({
      files: ['**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': [
          'warn',
          {
            selector:
              "Literal[value=/^#(?:[0-9a-fA-F]{3,4}){1,2}$/], TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3}){1,2}/]",
            message:
              'No raw color literals — use tokens from @towing/theme (useTheme). Colors live only in the theme package.',
          },
        ],
      },
    });
  }

  return config;
}

module.exports = towingConfig;
module.exports.default = towingConfig;
