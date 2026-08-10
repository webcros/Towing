import { useTheme } from '@towing/theme';
import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { AnimatedScrollView } from './AnimatedParts';

/** Scroll distance over which the hairline under a fixed header fades in. */
const HAIRLINE_RANGE = 12;

/**
 * Tracks scroll offset on the UI thread and returns the props a `Screen` needs
 * to feed it.
 *
 * Deliberately *not* gated on reduce-motion. A header that follows your finger
 * is direct manipulation, not vestibular motion — freezing it would be a bug,
 * not an accommodation.
 *
 * ```tsx
 * const { scrollY, screenProps } = useCollapsingHeader();
 * <Screen scroll {...screenProps} header={<AppHeader scrollY={scrollY} title="…" />} />
 * ```
 */
export function useCollapsingHeader() {
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return {
    scrollY,
    screenProps: {
      ScrollComponent: AnimatedScrollView,
      scrollProps: { onScroll, scrollEventThrottle: 16 },
    },
  } as const;
}

/**
 * Hairline + shadow that appear the moment content passes under a fixed bar,
 * so the bar reads as floating above the content rather than welded to it.
 */
export function useHairlineStyle(scrollY: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HAIRLINE_RANGE], [0, 1], Extrapolation.CLAMP),
  }));
}

/**
 * Hands a large in-content title over to a compact one in the bar.
 *
 * `from`/`to` bracket the scroll range over which the handoff happens; it
 * starts a little after the top so a stray one-pixel scroll does not flicker
 * the title.
 */
export function useTitleHandoff(scrollY: SharedValue<number>, from = 8, to = 48) {
  const appearing = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [from, to], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [from, to], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  const leaving = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [from, to], [1, 0], Extrapolation.CLAMP),
  }));

  return { appearing, leaving };
}

/** Hairline colour + thickness, so callers do not re-derive it. */
export function useHairlineToken() {
  const theme = useTheme();
  return { height: 1, backgroundColor: theme.colors.border } as const;
}
