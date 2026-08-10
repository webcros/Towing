import React from 'react';
import { useTheme } from '@towing/theme';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { PressablePrimitiveProps, HapticIntent } from '@towing/ui';
import { AnimatedPressable } from './AnimatedParts';
import { haptics } from './haptics';

function fireHaptic(intent: HapticIntent) {
  switch (intent) {
    case 'selection':
      return haptics.selection();
    case 'light':
      return haptics.light();
    case 'medium':
      return haptics.medium();
    case 'success':
      return haptics.success();
    default:
      return undefined;
  }
}

/**
 * Reanimated-backed Pressable: springs down on press-in, back on press-out,
 * and optionally fires a haptic. Mounted once via `PressablePrimitiveProvider`,
 * which animates every shared component at the same time.
 *
 * The shape here is load-bearing and the three obvious alternatives all fail:
 *
 *   - Passing a *function* `style` straight through. Reanimated inspects `style`
 *     statically to find animated values, so one returned from a function is
 *     never found and the scale silently does nothing. Hence the function form
 *     is resolved in JS below and only a static array is handed down.
 *   - Wrapping the children in an `Animated.View` *inside* the Pressable. The
 *     wrapper then sits inside the padding, so `Button` would scale its label
 *     and not its pill.
 *   - Wrapping the Pressable in an `Animated.View`. That view defaults to
 *     `alignSelf: 'stretch'` in a column parent and silently overrides
 *     `Button`'s own `alignSelf: fullWidth ? 'stretch' : 'flex-start'`.
 *
 * Resolving in JS costs one setState per press — the same re-render the
 * function-style form already caused — and adds no view to the tree.
 *
 * Reduce-motion needs no handling: `withSpring` defaults to
 * `ReduceMotion.System` and jumps straight to the target when it is on.
 */
export function MotionPressable({
  pressScale,
  haptic,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressablePrimitiveProps) {
  const theme = useTheme();
  const [pressed, setPressed] = React.useState(false);
  const progress = useSharedValue(0);

  const target = pressScale ?? theme.motion.pressScale.button;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (target - 1) * progress.value }],
  }));

  const resolved =
    typeof style === 'function' ? style({ pressed }) : style;

  return (
    <AnimatedPressable
      {...rest}
      style={[resolved, animatedStyle]}
      onPressIn={(event) => {
        setPressed(true);
        progress.value = withSpring(1, theme.motion.spring.press);
        if (haptic) fireHaptic(haptic);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        progress.value = withSpring(0, theme.motion.spring.press);
        onPressOut?.(event);
      }}
    />
  );
}
