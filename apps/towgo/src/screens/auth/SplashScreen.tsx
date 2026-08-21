import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Logo } from '@/components/Logo';

/** Shown while `authStore.hydrate()` reads the persisted session from MMKV (spec §9.1 root gate). */
export function SplashScreen() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
      }}
    >
      {/*
        The brand mark rather than `expoConfig.name` as text: the config name is
        the store listing ("Moveyo"), which is not what the artwork says, and a
        gate this brief should not be where the two disagree in front of the
        user. Wider than the header instance — this one is the only thing on
        screen.
      */}
      <Logo width={200} />
      <ActivityIndicator color={theme.colors.brand} />
    </View>
  );
}
