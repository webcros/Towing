import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Decorative clearance between a floating bar and the system navigation area. */
export const FLOATING_BAR_GAP = 12;

/**
 * Android's gesture navigation bar is ~24dp and its 3-button bar ~48dp. Used as a
 * floor so a bogus `insets.bottom === 0` still clears the tallest gesture bar.
 */
const ANDROID_NAV_FLOOR = 24;

/**
 * Bottom offset for a floating bottom bar.
 *
 * Deliberately **additive** — `max(inset, floor) + gap` — not `max(inset, gap)`.
 * The latter conflates two unrelated quantities and fails in both directions:
 *
 *   - When the inset is reported correctly (48dp, 3-button nav) `max(48, 12)` is
 *     48, which puts the bar flush against the nav bar with no visual gap at all.
 *   - When the inset is wrongly reported as 0 — a known and still-open bug in
 *     react-native-safe-area-context on Android under edge-to-edge, where the
 *     provider view's visible rect cancels the real inset — `max(0, 12)` is 12,
 *     and the 24–48dp nav bar then paints over the bar's lower half.
 *
 * The second case is why the symptom looked device-random: it is silent where the
 * gesture bar happens to be under 12dp and obvious where it is taller.
 *
 * Edge-to-edge is unconditional from Expo SDK 54 onward (Android 16 removed the
 * opt-out), so every Android device draws behind the navigation bar and this
 * offset is always load-bearing.
 */
export function useBottomBarOffset(gap: number = FLOATING_BAR_GAP): number {
  const insets = useSafeAreaInsets();
  const floor = Platform.OS === 'android' ? ANDROID_NAV_FLOOR : 0;
  return Math.max(insets.bottom, floor) + gap;
}
