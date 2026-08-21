import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@towing/theme';
import { Text, Button, Skeleton, StatusBadge } from '@towing/ui';
import { Info, TrendingUp } from '@/icons';
import { Pressable } from '@/motion';
import { formatPaise } from '@/utils/format';

// Figma 31:176 — border-top bar: fare + "Total Estimate ⓘ" left, CTA right.
export function BookingBottomBar({
  farePaise,
  loading,
  surgeActive,
  onConfirm,
  onBreakdownPress,
  confirmDisabled,
  confirming,
  errorMessage,
}: {
  /**
   * INTEGER PAISE, not rupees (Phase 14). This was a rupee `number` rendered
   * with `formatINR`, fed from a hardcoded price in `towTypes.data.ts`. It now
   * comes off `POST /v1/pricing/estimate`, and the whole API speaks paise —
   * `format.ts` carries an explicit warning that reusing `formatINR` on a paise
   * value misformats it by 100×, which is exactly the bug this rename prevents.
   */
  farePaise: number | undefined;
  loading: boolean;
  surgeActive: boolean;
  onConfirm: () => void;
  onBreakdownPress: () => void;
  confirmDisabled: boolean;
  /** §9.1.5's "confirming (spinner)" state. */
  confirming?: boolean;
  /** A §3.8 guard the customer needs to read, not a toast that vanishes. */
  errorMessage?: string | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12),
        gap: 10,
      }}
    >
      {errorMessage ? (
        <Text color="error" style={{ fontSize: 12, lineHeight: 18 }}>
          {errorMessage}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View>
          {loading || farePaise === undefined ? (
            // §10.8 — a bone the exact height of the figure it replaces, so the
            // bar does not resize when the estimate lands.
            <Skeleton width={92} height={25} radius={theme.radii.input} />
          ) : (
            <Text weight="semibold" tabular style={{ fontSize: 20, lineHeight: 25, letterSpacing: -0.5 }}>
              {formatPaise(farePaise)}
            </Text>
          )}

          {/*
            THE ⓘ IS NOW REAL. It was a bare SVG inside a plain `View` — no
            `onPress`, no `hitSlop`, no accessibility role — so tapping the thing
            that looks most tappable on the screen did nothing. The whole row is
            the target, not the 12dp glyph.
          */}
          <Pressable
            onPress={onBreakdownPress}
            disabled={farePaise === undefined}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="View fare breakdown"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}
          >
            <Text color="secondary" style={{ fontSize: 12, lineHeight: 18 }}>
              Total Estimate
            </Text>
            <Info size={12} color={theme.colors.textTertiary} />
            {surgeActive ? <StatusBadge label="Surge" tone="warning" pill icon={TrendingUp} /> : null}
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <Button
            label={confirming ? 'Confirming…' : 'Confirm Booking'}
            onPress={onConfirm}
            fullWidth
            height={47}
            disabled={confirmDisabled}
          />
        </View>
      </View>
    </View>
  );
}
