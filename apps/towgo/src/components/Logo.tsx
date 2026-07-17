import React from 'react';
import { Image } from 'react-native';

const logo = require('@/assets/brand/logo.png');

/** TowGo wordmark — exact Figma logo asset (494×190, ratio ~2.6). */
export function Logo() {
  return (
    <Image
      source={logo}
      resizeMode="contain"
      style={{ width: 120, height: 46 }}
      accessibilityLabel="TowGo"
    />
  );
}
