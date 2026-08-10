import React from 'react';
import { Pressable, type ScrollViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

/** Pressable with an animated `style`, used by MotionPressable. */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Reanimated types `Animated.ScrollView` as `ComponentType<AnimatedProps<...>>`,
 * which will not assign to the plain `ComponentType<ScrollViewProps>` that the
 * `Screen` seam accepts. The cast is contained here so `packages/ui` stays free
 * of both the dependency and the `any`.
 */
export const AnimatedScrollView =
  Animated.ScrollView as unknown as React.ComponentType<ScrollViewProps>;
