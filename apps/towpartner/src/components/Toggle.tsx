import React from 'react';
import { Switch } from 'react-native';
import { useTheme } from '@towing/theme';

/** Themed switch (brand track). */
export function Toggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.colors.borderStrong, true: theme.colors.brand }}
      thumbColor={theme.colors.card}
      ios_backgroundColor={theme.colors.borderStrong}
    />
  );
}
