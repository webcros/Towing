import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@towing/ui';
import { driverColors } from '@/theme/driverColors';

/**
 * §6.3's twenty-second countdown, as a ring.
 *
 * A RING RATHER THAN A NUMBER because the decision is made in peripheral vision.
 * A driver glancing at a phone propped on a dashboard reads "how much is left"
 * from the arc long before they read a digit, and the number is there for the
 * last few seconds when it starts to matter precisely.
 *
 * `react-native-svg` is already a dependency (every icon in the app is one), so
 * this adds no native module.
 */
export function CountdownRing({
  secondsLeft,
  fraction,
  size = 96,
  strokeWidth = 7,
}: {
  secondsLeft: number;
  /** 1 at the start, 0 at expiry. */
  fraction: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(1, fraction)) * circumference;

  /**
   * Amber throughout, red for the last five seconds.
   *
   * Not a gradient across the whole range: a ring that is already reddening at
   * twelve seconds trains a driver to ignore the colour. The change has to mean
   * "now", which it only can if it happens once and late.
   */
  const urgent = secondsLeft <= 5;
  const colour = urgent ? '#DC2626' : driverColors.amber;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F3F4F6"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Remaining, drawn from the top and running down. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colour}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          // -90° so the arc starts at twelve o'clock rather than three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <Text weight="bold" tabular style={{ fontSize: 30, lineHeight: 36, color: colour }}>
        {secondsLeft}
      </Text>
      <Text style={{ fontSize: 11, lineHeight: 14, color: '#6B7280' }}>seconds</Text>
    </View>
  );
}
