import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@towing/theme';

export type BottomScrimProps = {
  /** Total fade height. Usually the tab bar's reserved space plus a little. */
  height: number;
  /** Colour the content dissolves into. Defaults to the page background. */
  color?: string;
};

/**
 * Vertical fade behind a floating bottom bar.
 *
 * Content scrolls *behind* the floating bar in both apps, which without this
 * reads as a hard cut: a line of text is fully legible right up to the bar's
 * edge and then simply disappears under it. The scrim fades the page into its
 * own background over the bar's height, so content dissolves out instead.
 *
 * Drawn with `react-native-svg`, already a dependency of both apps, rather than
 * pulling in `expo-linear-gradient` for one gradient.
 *
 * The stops are deliberately not linear. A straight ramp leaves the top edge
 * visible as a faint band; easing the opacity so it stays low for the first
 * third makes the start of the fade impossible to locate.
 */
export function BottomScrim({ height, color }: BottomScrimProps) {
  const theme = useTheme();
  const fill = color ?? theme.colors.surface0;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="bottomScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fill} stopOpacity={0} />
            <Stop offset="0.35" stopColor={fill} stopOpacity={0.35} />
            <Stop offset="0.65" stopColor={fill} stopOpacity={0.8} />
            <Stop offset="1" stopColor={fill} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomScrim)" />
      </Svg>
    </View>
  );
}
