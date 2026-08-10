import React from 'react';
import { Image, View } from 'react-native';
import { Text } from '@towing/ui';

const heroImage = require('@/assets/illustrations/tow-truck-hero.png');

// Figma 21:3 — title 34/42.5 bold, paragraph 11/21.75 (216 wide),
// truck 162×105 flush to the right edge.
export function ServicesHero() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 20,
        paddingRight: 0,
        paddingTop: 16,
        paddingBottom: 20,
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text variant="display" weight="bold" style={{ lineHeight: 42, letterSpacing: -0.68 }}>
          Services
        </Text>
        <Text
          color="secondary"
          style={{ fontSize: 11, lineHeight: 18, marginTop: 10, maxWidth: 216 }}
        >
          We offer a range of towing and roadside assistance services to get you back on the road
          safely.
        </Text>
      </View>
      <Image
        source={heroImage}
        resizeMode="contain"
        style={{ width: 162, height: 105 }}
        accessibilityIgnoresInvertColors
        accessibilityLabel="Tow truck carrying a car"
      />
    </View>
  );
}
