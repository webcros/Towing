import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { driverColors } from '@/theme/driverColors';

/** Cream rounded hero-card shell (dashboard online status, earnings total). */
export function HeroCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: driverColors.heroBg,
          borderRadius: 24,
          padding: 20,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
