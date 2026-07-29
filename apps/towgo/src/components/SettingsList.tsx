import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';

/** Grouped card that auto-divides its SettingsRow children. */
export function SettingsList({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        ...theme.shadows.card,
      }}
    >
      {items.map((child, i) => (
        <View key={i}>
          {child}
          {i < items.length - 1 ? (
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: 16 }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}
