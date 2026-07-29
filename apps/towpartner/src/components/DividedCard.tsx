import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';

/**
 * Bordered card that stacks its children with full-width hairline dividers
 * (Home "Recent Activity", Earnings "Recent Transactions").
 */
export function DividedCard({ children }: { children: React.ReactNode }) {
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
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}
