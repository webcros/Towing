import type { ExpoConfig } from 'expo/config';

/**
 * TowPartner (driver app) Expo config. Sibling of TowGo in the same monorepo,
 * sharing the @towing/* packages. Dynamic (TS) so future secrets — Google Maps,
 * the Socket.io URL, payout keys — can be injected from env into `extra` without
 * touching a static JSON file.
 */
const config: ExpoConfig = {
  name: 'TowPartner',
  slug: 'towpartner',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'towpartner',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'in.webcros.towpartner',
  },
  android: {
    package: 'in.webcros.towpartner',
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#FB923C',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
        dark: {
          backgroundColor: '#15181F',
        },
      },
    ],
  ],
  extra: {
    // Toggle mock data source vs the (future) real REST backend.
    useMocks: process.env.EXPO_PUBLIC_USE_MOCKS ?? 'true',
    // `eas.projectId` is added by `eas init` when this app is first built.
  },
};

export default config;
