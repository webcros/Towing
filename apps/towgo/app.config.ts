import type { ExpoConfig } from 'expo/config';

/**
 * TowGo (customer app) Expo config. Dynamic (TS) so future secrets — Google
 * Maps, Razorpay, the Socket.io URL — can be injected from env into `extra`
 * without touching a static JSON file.
 */
const config: ExpoConfig = {
  name: 'Moveyo',
  slug: 'moveyo',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'moveyo',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'in.webcros.moveyo',
  },
  android: {
    package: 'in.webcros.moveyo',
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#FFB800',
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
    eas: {
      projectId: '55703152-71a7-46c0-8cf6-f70971c0bf53',
    },
  },
};

export default config;
