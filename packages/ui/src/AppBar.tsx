import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';

export type AppBarProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
};

/** Top app bar: 56px, three slots (left / center / right). */
export function AppBar({ left, center, right }: AppBarProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.md,
      }}
    >
      <View style={{ minWidth: 44, alignItems: 'flex-start' }}>{left}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>{center}</View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
