import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@towing/theme';
import { MapPin, Truck } from '@/icons';

// Stylized route + nearby drivers drawn over the placeholder map. Positions are
// decorative (percent-based) until real Google Maps geo lands.
const DRIVERS: { left: `${number}%`; top: `${number}%` }[] = [
  { left: '54%', top: '30%' },
  { left: '30%', top: '50%' },
  { left: '72%', top: '44%' },
];

export function MapRouteOverlay() {
  const theme = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Route line pickup → drop */}
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path
          d="M 26 26 Q 44 34 66 62"
          stroke={theme.colors.brand}
          strokeWidth={2.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>

      {/* Driver markers */}
      {DRIVERS.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: d.left,
            top: d.top,
            marginLeft: -16,
            marginTop: -16,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.fab,
          }}
        >
          <Truck size={17} color={theme.colors.textPrimary} strokeWidth={2} />
        </View>
      ))}

      {/* Pickup pin (green) */}
      <View style={{ position: 'absolute', left: '26%', top: '26%', marginLeft: -11, marginTop: -22 }}>
        <MapPin size={22} color={theme.colors.success} fill={theme.colors.success} />
      </View>

      {/* Drop pin (red) */}
      <View style={{ position: 'absolute', left: '66%', top: '62%', marginLeft: -11, marginTop: -22 }}>
        <MapPin size={22} color={theme.colors.error} fill={theme.colors.error} />
      </View>
    </View>
  );
}
