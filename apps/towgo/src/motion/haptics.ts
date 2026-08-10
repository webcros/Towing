import * as Haptics from 'expo-haptics';

let enabled = true;

/** Seam for a future Settings toggle, mirroring the themeStore pattern. */
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

/**
 * Haptics reject on emulators and on hardware without a taptic engine, and an
 * unhandled rejection is dev-mode warning spam on every single tap. Always
 * swallow — feedback that cannot fire is not an error.
 */
function fire(run: () => Promise<void>) {
  if (!enabled) return;
  void run().catch(() => {});
}

export const haptics = {
  /** Tab change, sheet snap-index change, segmented control. */
  selection: () => fire(() => Haptics.selectionAsync()),
  /** Secondary, ghost and destructive buttons; card and row taps. */
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Primary CTA — "Confirm Booking". */
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Driver found, booking confirmed. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticName = keyof typeof haptics;
