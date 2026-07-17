import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@towing/theme';

export type DividerProps = {
  vertical?: boolean;
  /** Inset along the divider's length (margin on both ends). */
  inset?: number;
  style?: StyleProp<ViewStyle>;
};

export function Divider({ vertical = false, inset = 0, style }: DividerProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        { backgroundColor: theme.colors.divider },
        vertical
          ? { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: inset }
          : { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: inset },
        style,
      ]}
    />
  );
}
