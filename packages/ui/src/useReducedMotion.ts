import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the OS "reduce motion" setting is enabled (spec §10.7 / §10.11).
 *
 * Uses the `AccessibilityInfo` listener rather than a one-shot read, so a
 * change made while the app is running re-renders the consumer. Reanimated
 * ships a hook of the same name, but that one is a snapshot taken at app start
 * and explicitly does not re-render — use this one for anything driven by React
 * state (RN `Animated` loops, navigator options), and rely on Reanimated's own
 * `ReduceMotion.System` default for `withTiming` / `withSpring` / entering
 * animations, which honour the setting with no code at all.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
