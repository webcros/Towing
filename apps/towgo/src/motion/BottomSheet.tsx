import React, { useCallback, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@towing/theme';
import { haptics } from './haptics';

/**
 * How far a fling is projected past the finger when choosing a snap point.
 * 0.15s of travel at release velocity — enough that a flick reaches the next
 * detent without having to drag all the way there.
 */
const FLING_PROJECTION = 0.15;

/** Vertical slop before the sheet starts dragging, and the horizontal slop that
 *  hands the gesture to a horizontal carousel instead. */
const ACTIVE_OFFSET_Y = 8;
const FAIL_OFFSET_X = 16;

export type BottomSheetProps = {
  /**
   * Snap heights in dp, ascending. The sheet is laid out at the tallest and
   * translated down, so each height is measured from the bottom of the screen.
   */
  snapPoints: number[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Grabber and title row, above the scroller. */
  header?: React.ReactNode;
  /** Pinned to the sheet's bottom, outside the scroller — a CTA belongs here. */
  footer?: React.ReactNode;
  /**
   * Receives the sheet's current height, so a caller can pin something to its
   * top edge (a recenter FAB, say) and have it ride the sheet.
   */
  height?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Draggable bottom sheet over a map.
 *
 * Hand-rolled rather than pulled from a library because both sheets in this app
 * are non-modal, always visible and in-screen: no backdrop, no portal, no
 * keyboard avoidance, no dynamic sizing. It is built entirely from primitives
 * the rest of the motion system already uses, so it adds no dependency.
 *
 * The scroll/pan handoff is the whole difficulty, and is resolved three ways at
 * once:
 *
 *   - Below the top snap the inner list is not scrollable at all, so a drag
 *     anywhere moves the sheet. `scrollEnabled` is driven from the UI thread via
 *     `useAnimatedProps`, so it flips in the same frame as the gesture rather
 *     than a React render later.
 *   - At the top snap the list scrolls, and the pan yields while the list is
 *     scrolled away from its own top. `simultaneousWithExternalGesture` lets both
 *     recognisers stay active, so neither has to fail before the other can act —
 *     that is what makes scrolling and dragging blend rather than fight.
 *   - `failOffsetX` hands sideways movement to any horizontal scroller inside
 *     the sheet, so swiping the tow-type carousel does not drag the sheet.
 *
 * Reduce-motion needs no handling: `withSpring` honours `ReduceMotion.System`
 * and snaps instantly. Gesture tracking stays live either way — direct
 * manipulation is not the kind of motion that setting is about.
 */
export function BottomSheet({
  snapPoints,
  initialIndex = 0,
  onIndexChange,
  header,
  footer,
  height,
  style,
  children,
}: BottomSheetProps) {
  const theme = useTheme();
  const smooth = theme.motion.spring.smooth;

  const points = useMemo(() => [...snapPoints].sort((a, b) => a - b), [snapPoints]);
  const maxHeight = points[points.length - 1] ?? 0;
  const minHeight = points[0] ?? 0;

  // translateY 0 is fully expanded; larger values push the sheet down.
  const expandedOffset = 0;
  const collapsedOffset = maxHeight - minHeight;

  const startIndex = Math.min(Math.max(initialIndex, 0), Math.max(points.length - 1, 0));

  const translateY = useSharedValue(maxHeight - (points[startIndex] ?? 0));
  const dragStart = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const index = useSharedValue(startIndex);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const notify = useCallback(
    (next: number) => {
      onIndexChange?.(next);
      haptics.light();
    },
    [onIndexChange],
  );

  const pan = Gesture.Pan()
    .activeOffsetY([-ACTIVE_OFFSET_Y, ACTIVE_OFFSET_Y])
    .failOffsetX([-FAIL_OFFSET_X, FAIL_OFFSET_X])
    // Gesture-handler types this as a ref to a plain component; Reanimated's
    // AnimatedRef is the same object with a narrower generic.
    .simultaneousWithExternalGesture(scrollRef as unknown as React.RefObject<React.ComponentType>)
    .onBegin(() => {
      dragStart.value = translateY.value;
    })
    .onUpdate((event) => {
      // While the list is scrolled down, it owns the gesture. Re-anchoring the
      // drag origin each frame means the sheet picks up smoothly from wherever
      // the finger is once the list reaches its top, with no jump.
      if (translateY.value <= expandedOffset && scrollY.value > 0) {
        dragStart.value = translateY.value - event.translationY;
        return;
      }
      translateY.value = clamp(
        dragStart.value + event.translationY,
        expandedOffset,
        collapsedOffset,
      );
    })
    .onEnd((event) => {
      const projected = translateY.value + event.velocityY * FLING_PROJECTION;

      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < points.length; i++) {
        const candidate = maxHeight - (points[i] ?? 0);
        const distance = Math.abs(projected - candidate);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      }

      const changed = best !== index.value;
      index.value = best;
      translateY.value = withSpring(maxHeight - (points[best] ?? 0), smooth, () => {
        if (changed) runOnJS(notify)(best);
      });
    });

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Half a pixel of tolerance so a spring that settles at 0.0001 still counts
  // as expanded.
  const scrollProps = useAnimatedProps(() => ({
    scrollEnabled: translateY.value <= expandedOffset + 0.5,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useAnimatedReaction(
    () => maxHeight - translateY.value,
    (current) => {
      if (height) height.value = current;
    },
    [height, maxHeight],
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: maxHeight,
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 16,
          },
          sheetStyle,
          style,
        ]}
      >
        <View style={{ alignItems: 'center', paddingTop: 12 }}>
          <View
            style={{
              width: 40,
              height: 6,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surface1,
            }}
          />
        </View>

        {header}

        <Animated.ScrollView
          ref={scrollRef}
          style={{ flexShrink: 1 }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          animatedProps={scrollProps}
        >
          {children}
        </Animated.ScrollView>

        {footer}
      </Animated.View>
    </GestureDetector>
  );
}
