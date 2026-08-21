import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@towing/theme';
import { StatusBadge, Text } from '@towing/ui';
import { Info, RadioTower, ShieldCheck } from '@/icons';
import type { GoOnlineFailure } from '@/features/presence/api/presence.queries';
import { HeroCard } from '@/components/HeroCard';
import { driverColors } from '@/theme/driverColors';
import { Pressable } from '@/motion';

const heroTruck = require('@/assets/illustrations/tow-truck-hero.png');

/** Toggle geometry. The knob travels between the two ends of the track. */
const KNOB = 40;
/** Track padding around the knob, so the knob sits inset rather than flush. */
const INSET = 3;
/** Gap between the knob and the label. */
const GAP = 10;
/** Padding past the label, on whichever side the knob is not. */
const PAD_END = 18;

/**
 * How far the label shifts when the knob changes sides.
 *
 * Laid out online it is `[inset][knob][gap][label][padEnd]`; offline it becomes
 * `[inset][padEnd][label][gap][knob]`. The label's left edge therefore moves by
 * `PAD_END - KNOB - GAP`, which is a constant — so only the knob's travel needs
 * the measured track width.
 */
const LABEL_SHIFT = PAD_END - KNOB - GAP;

/**
 * Dashboard hero: online/offline status + availability toggle.
 *
 * Two-column flow layout (text column + truck image) so nothing can overlap or
 * overflow on narrow screens or large font settings.
 */
export function OnlineStatusCard({
  isOnline,
  onToggle,
  disabled = false,
  busy = false,
  zoneName = null,
  failure = null,
}: {
  isOnline: boolean;
  onToggle: () => void;
  /**
   * A go-online or go-offline call is in flight (Phase 16). The toggle is not
   * instant any more — it asks for permission, takes a GPS fix and calls the
   * server — so it has to say so, or a driver taps it repeatedly.
   */
  busy?: boolean;
  /**
   * The §6.1 zone the driver was placed in. Shown because it is the difference
   * between "online" and "online somewhere jobs actually come from", and a
   * driver who sees no zone name has a real problem worth noticing.
   */
  zoneName?: string | null;
  /**
   * Why the last attempt failed. Rendered in the card rather than as a toast:
   * every one of these needs the driver to DO something (grant a permission,
   * drive into a covered area, contact support), and a message that disappears
   * after three seconds is not a place to put an instruction.
   */
  failure?: GoOnlineFailure | null;
  /**
   * True while the driver isn't KYC-approved. Renders a verification banner
   * instead of the toggle — kycStatus itself is NOT duplicated into
   * `driverStatusStore` (that store only owns the local online/offline bit);
   * the caller reads `authStore.identity.kycStatus` directly and passes the
   * derived boolean down, which is the smaller diff than teaching this store
   * about a concept it otherwise has no reason to know.
   */
  disabled?: boolean;
}) {
  const theme = useTheme();
  const snappy = theme.motion.spring.snappy;

  // The track sizes itself to its content; the knob's travel depends on that
  // width, so it has to be measured rather than assumed.
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = Math.max(trackWidth - INSET * 2 - KNOB, 0);

  // 0 = online (knob left), 1 = offline (knob right).
  const progress = useSharedValue(isOnline ? 0 : 1);
  const settled = useRef(false);

  useEffect(() => {
    const target = isOnline ? 0 : 1;
    if (!settled.current) {
      // First commit: adopt the current state without sliding in from nowhere.
      progress.value = target;
      settled.current = true;
      return;
    }
    progress.value = withSpring(target, snappy);
  }, [isOnline, progress, snappy]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * LABEL_SHIFT }],
  }));
  const onlineLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const offlineLabelStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setTrackWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  };

  if (disabled) {
    return (
      <HeroCard style={{ paddingVertical: 18, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <StatusBadge label="Verification pending" tone="warning" icon={ShieldCheck} pill />
            <Text weight="medium" style={{ fontSize: 22, lineHeight: 28, marginTop: 4 }}>
              You're not online yet
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: '#4B5563' }}>
              Finish your KYC verification to start accepting tow requests.
            </Text>
          </View>
          <Image
            source={heroTruck}
            resizeMode="contain"
            style={{ width: '46%', aspectRatio: 414 / 228, alignSelf: 'center', opacity: 0.45 }}
          />
        </View>
      </HeroCard>
    );
  }

  return (
    <HeroCard style={{ paddingVertical: 18, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
        {/* Status copy + toggle */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563' }}>You are</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text
              weight="medium"
              numberOfLines={1}
              style={{
                fontSize: 34,
                lineHeight: 44,
                flexShrink: 1,
                color: isOnline ? driverColors.online : theme.colors.textSecondary,
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: isOnline ? driverColors.onlineDot : theme.colors.textTertiary,
              }}
            />
          </View>

          <Text style={{ fontSize: 13, lineHeight: 18, color: '#4B5563', marginTop: 6 }}>
            {isOnline
              ? zoneName
                ? `Receiving requests in ${zoneName}`
                : 'You will receive new tow requests'
              : "You're offline. Go online to receive requests"}
          </Text>

          {failure ? <FailureNote failure={failure} /> : null}

          <Pressable
            onPress={onToggle}
            onLayout={onTrackLayout}
            disabled={busy}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOnline, disabled: busy, busy }}
            accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              height: KNOB + INSET * 2,
              paddingHorizontal: INSET,
              borderRadius: 9999,
              marginTop: 18,
              // Dims by colour, not alpha: this node carries elevation, and on
              // Android the elevation shadow is drawn outside the view's own
              // alpha, so fading it makes the shadow show through the pill.
              backgroundColor: pressed ? theme.colors.surface1 : theme.colors.card,
              ...theme.shadows.card,
            })}
          >
            {/* Reserves the knob's slot so the track sizes correctly. The knob
                itself is absolute, because it has to be able to cross the label. */}
            <View style={{ width: KNOB + GAP }} />

            <Animated.View style={labelStyle}>
              {/* "Go Offline" is the wider of the two, so it is the copy in flow
                  and sets the track's width. Sizing to "Go Online" would make the
                  track resize as it toggles, which would change the knob's travel
                  mid-animation. */}
              <Animated.View style={onlineLabelStyle}>
                <Text weight="medium" numberOfLines={1} style={{ fontSize: 13 }}>
                  Go Offline
                </Text>
              </Animated.View>
              <Animated.View
                style={[{ position: 'absolute', left: 0, right: 0 }, offlineLabelStyle]}
              >
                <Text weight="medium" numberOfLines={1} align="center" style={{ fontSize: 13 }}>
                  Go Online
                </Text>
              </Animated.View>
            </Animated.View>

            <View style={{ width: PAD_END }} />

            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: INSET,
                  width: KNOB,
                  height: KNOB,
                  borderRadius: KNOB / 2,
                  backgroundColor: driverColors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                knobStyle,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <RadioTower size={18} color="#FFFFFF" strokeWidth={2.4} />
              )}
            </Animated.View>
          </Pressable>
        </View>

        {/* Truck illustration — in normal flow, never overlaps the copy. */}
        <Image
          source={heroTruck}
          resizeMode="contain"
          style={{ width: '46%', aspectRatio: 414 / 228, alignSelf: 'center' }}
        />
      </View>
    </HeroCard>
  );
}

/**
 * Why the driver is not online, and what to do about it.
 *
 * Each branch names a DIFFERENT remedy, which is the reason `usePresence`
 * returns a discriminated failure rather than a string: "you did not grant
 * location", "you are outside every service area" and "an admin suspended you"
 * are three unrelated problems, and flattening them into one "could not go
 * online" would leave the driver guessing which of the three they have.
 */
function FailureNote({ failure }: { failure: GoOnlineFailure }) {
  const message = {
    'permission-denied':
      'Location permission is off. Turn it on in Settings to start receiving jobs.',
    'no-fix': "Couldn't get a GPS fix. Move somewhere with a clearer view of the sky and try again.",
    'outside-zone': failure.kind === 'outside-zone' ? failure.message : '',
    'not-approved': 'Your account is not approved to go online. Contact support.',
    failed: failure.kind === 'failed' ? failure.message : '',
  }[failure.kind];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
      <Info size={14} color="#B45309" style={{ marginTop: 2 }} />
      <Text style={{ fontSize: 12, lineHeight: 17, color: '#B45309', flex: 1 }}>{message}</Text>
    </View>
  );
}
