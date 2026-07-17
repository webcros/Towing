import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '../Text';

export type OfflineBannerProps = {
  visible?: boolean;
  message?: string;
};

/**
 * Persistent slim offline strip (spec §10.9). Presentational only — the app
 * decides visibility from its connectivity hook.
 */
export function OfflineBanner({
  visible = true,
  message = "You're offline — showing saved info",
}: OfflineBannerProps) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface1,
        paddingVertical: 6,
        paddingHorizontal: theme.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.warning }}
      />
      <Text variant="micro" weight="medium" color="secondary">
        {message}
      </Text>
    </View>
  );
}
