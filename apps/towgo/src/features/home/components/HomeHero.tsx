import React from 'react';
import { Image, View } from 'react-native';
import { Text } from '@towing/ui';

const heroImage = require('@/assets/illustrations/tow-truck-hero.png');

export function HomeHero() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        // Left inset only — the truck bleeds to the right screen edge (Figma).
        paddingLeft: 20,
        paddingRight: 0,
        paddingTop: 2,
        paddingBottom: 8,
        minHeight: 160,
      }}
    >
      <View style={{ flex: 1, paddingRight: 4 }}>
        <Text variant="display" weight="bold">
          Fast Towing,{'\n'}Anytime
        </Text>
        <Text
          color="secondary"
          weight="medium"
          style={{ fontSize: 12.7, lineHeight: 17.5, marginTop: 8 }}
        >
          Reliable tow trucks near you. Just book and we&apos;ll be there.
        </Text>
      </View>
      <Image
        source={heroImage}
        resizeMode="contain"
        style={{ width: 152, height: 98 }}
        accessibilityIgnoresInvertColors
        accessibilityLabel="Tow truck loading a car"
      />
    </View>
  );
}
