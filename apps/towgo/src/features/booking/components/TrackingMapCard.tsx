import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@towing/theme';
import { MapPreview } from '@towing/ui';
import { MapPin, Truck } from '@/icons';

/**
 * Map with a stylized route: driver tow-truck (top-right) → pickup
 * pin (bottom-left). Static until real Google Maps + live driver location.
 *
 * `fullBleed` drops the card chrome and fills the parent instead. The route Svg
 * uses a viewBox with preserveAspectRatio="none" and both markers are
 * positioned in percentages, so everything reflows to the new box on its own.
 */
export function TrackingMapCard({ fullBleed = false }: { fullBleed?: boolean } = {}) {
  const theme = useTheme();

  return (
    <View
      style={
        fullBleed
          ? {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              backgroundColor: theme.colors.card,
            }
          : {
              height: 340,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
              backgroundColor: theme.colors.card,
              ...theme.shadows.card,
            }
      }
    >
      <MapPreview style={StyleSheet.absoluteFill} showRecenter={false} />

      {/* Route line */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path
          d="M 84 27 L 62 40 Q 56 43 52 50 L 40 66 Q 36 71 28 74 L 17 79"
          stroke={theme.colors.textPrimary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>

      {/* Driver (top-right) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: '84%',
          top: '27%',
          marginLeft: -21,
          marginTop: -21,
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: theme.colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.fab,
        }}
      >
        <Truck size={22} color={theme.colors.textPrimary} strokeWidth={2} />
      </View>

      {/* Pickup pin (bottom-left) */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: '17%', top: '79%', marginLeft: -13, marginTop: -26 }}
      >
        <MapPin size={26} color={theme.colors.error} fill={theme.colors.error} />
      </View>
    </View>
  );
}
