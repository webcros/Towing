import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@towing/theme';
import { useReducedMotion } from './useReducedMotion';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** One full sweep of the highlight, left edge to right edge. */
const SWEEP_MS = 1100;
/** Pause between sweeps, so it reads as a pulse of light rather than a strobe. */
const GAP_MS = 350;
/** Band width as a fraction of the element. Wide enough to read on a short row. */
const BAND_RATIO = 0.6;

/**
 * Shimmering placeholder for first-paint loading (spec §10.8 — skeletons, never
 * spinners).
 *
 * Uses RN `Animated` rather than Reanimated on purpose: this component is shared
 * with the driver app, which installs no animation library, and `packages/ui` is
 * compiled from source by both apps. `react-native-svg` is already a dependency
 * of both, so the gradient costs nothing new.
 *
 * Only `translateX` is animated, on the native driver, so the sweep runs on the
 * UI thread and never touches the JS bridge per frame.
 *
 * Because this is RN `Animated` it does not inherit Reanimated's automatic
 * `ReduceMotion.System` handling — the loop is gated explicitly, and with the
 * setting on the placeholder renders as a flat block: still visibly a skeleton,
 * just not moving.
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  // The sweep distance is the element's own width, which is often a percentage,
  // so it has to be measured rather than read from props.
  const [measured, setMeasured] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setMeasured((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  };

  useEffect(() => {
    if (reduced || measured <= 0) return;

    progress.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(GAP_MS),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, measured]);

  const bandWidth = Math.max(measured * BAND_RATIO, 1);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, measured],
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.skeletonBase,
          // Clips the band to the rounded shape; without it the highlight would
          // run past the corners.
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {reduced || measured <= 0 ? null : (
        <Animated.View
          style={{
            width: bandWidth,
            height: '100%',
            transform: [{ translateX }],
          }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="skeletonSweep" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={theme.colors.skeletonHighlight} stopOpacity={0} />
                <Stop offset="0.5" stopColor={theme.colors.skeletonHighlight} stopOpacity={1} />
                <Stop offset="1" stopColor={theme.colors.skeletonHighlight} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#skeletonSweep)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
