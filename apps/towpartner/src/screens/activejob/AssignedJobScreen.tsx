import React, { useCallback } from 'react';
import { Linking, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Card, EmptyState, ErrorState, Screen, Skeleton, StatusBadge, Text } from '@towing/ui';
import { MapPin, MessageCircle, Navigation, Phone, RefreshCw, Truck, Lock } from '@/icons';
import { DriverHeader } from '@/components/DriverHeader';
import { Pill } from '@/components/Pill';
import { useCurrentJob } from '@/features/offers/api/offers.queries';
import { driverColors } from '@/theme/driverColors';
import { formatINR } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

const HAIRLINE = '#E5E7EB';
const INK_SOFT = '#4B5563';

/**
 * The job the driver holds (§16.3).
 *
 * WHERE ACCEPT LANDS, and deliberately a real screen rather than a bounce back
 * to the tabs: a driver who has just committed to a job needs the address, the
 * customer's number and the money in front of them immediately, and the twenty
 * seconds they spent deciding is exactly the moment they stop being able to
 * remember any of it.
 *
 * NO ARRIVE / START / COMPLETE. Those are Phase 18's, and they are added to THIS
 * screen rather than to a replacement — which is why the layout below leaves the
 * bottom of the screen to them and puts nothing there now. Building a second
 * "active job" screen next phase would mean building this one twice.
 *
 * It reads `GET /v1/driver/jobs/current` rather than anything handed over by the
 * accept, because a job can also END from the other side — a customer cancels, an
 * admin reassigns — and this screen must be able to say so.
 *
 * ⚠ NEVER RUN ON A DEVICE.
 */
export function AssignedJobScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: job, isPending, isError, refetch } = useCurrentJob();

  const onCall = useCallback(() => {
    if (!job?.customerMobile) return;
    // `.catch` rather than a thrown error: a handset with no dialler (a tablet)
    // is a bad experience, not a crash.
    Linking.openURL(`tel:${job.customerMobile}`).catch(() => {});
  }, [job?.customerMobile]);

  const onNavigate = useCallback(() => {
    if (!job) return;
    /**
     * HANDED OFF TO THE DRIVER'S OWN MAP APP, not drawn in-app.
     *
     * A turn-by-turn view inside MiTow Partner would be a worse Google Maps that
     * also has to stay alive while the OS wants to sleep the app — and it would
     * bill a Directions request per job on top. The handset already has a
     * navigation app the driver trusts and has configured.
     *
     * `geo:` on Android takes the coordinate directly; iOS has no `geo:`
     * handler, so the universal maps URL is the portable form and is what ships.
     */
    const { lat, lng } = job.pickup;
    const label = encodeURIComponent(job.pickupAddress ?? 'Pickup');
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving&dir_action=navigate#${label}`,
    ).catch(() => {});
  }, [job]);

  return (
    <Screen scroll edges={['top']} contentContainerStyle={{ paddingBottom: 28 }}>
      <DriverHeader
        leading="back"
        title="Your Job"
        subtitle={job ? job.reference : 'The job you accepted'}
        subtitleSize={14}
        onLeading={() => navigation.navigate('Tabs', { screen: 'Home' })}
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 3, gap: 12 }}>
        {isPending ? (
          <AssignedJobSkeleton />
        ) : isError ? (
          <ErrorState title="Couldn't load your job" onRetry={() => refetch()} icon={RefreshCw} />
        ) : !job ? (
          /*
           * Reachable and NOT an error: the customer cancelled, or an admin
           * reassigned. Saying "no active job" is the honest answer, and the way
           * back to work is the home screen.
           */
          <EmptyState
            icon={Truck}
            title="No active job"
            body="You're not on a job right now. New requests will appear when you're online."
          />
        ) : (
          <>
            {/* Status + money. The net repeated here on purpose: it is what they
                accepted on, and a figure that appears only once, twenty seconds
                before, is a figure they will ask support about later. */}
            <Card padding={18} style={{ borderRadius: 20, borderColor: HAIRLINE, gap: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ gap: 6 }}>
                  <StatusBadge label="Assigned" tone="info" pill icon={Truck} />
                  <Text color="secondary" style={{ fontSize: 13, lineHeight: 18 }}>
                    You earn
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    weight="bold"
                    tabular
                    style={{ fontSize: 28, lineHeight: 34, color: driverColors.online }}
                  >
                    {formatINR(job.earnings.netPaise / 100)}
                  </Text>
                  <Text tabular style={{ fontSize: 12, lineHeight: 17, color: '#6B7280' }}>
                    {formatINR(job.earnings.grossPaise / 100)} fare −{' '}
                    {formatINR(job.earnings.commissionPaise / 100)}
                    {job.earnings.commissionPct === null ? '' : ` (${job.earnings.commissionPct}%)`}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Customer + the two hand-offs. */}
            <Card padding={18} style={{ borderRadius: 20, borderColor: HAIRLINE, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="medium" numberOfLines={1} style={{ fontSize: 18, lineHeight: 25 }}>
                    {job.customerName ?? 'Customer'}
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: INK_SOFT }}>
                    {/* The number is EARNED BY ASSIGNMENT (§11.9 in the other
                        direction) — the offer carried a first name and nothing
                        else. Phase 18 masks it once telephony exists. */}
                    {job.customerMobile ?? 'Number available shortly'}
                  </Text>
                </View>
                <ActionChip icon={Phone} label="Call" onPress={onCall} disabled={!job.customerMobile} />
                <ActionChip icon={Navigation} label="Navigate" onPress={onNavigate} />
              </View>
            </Card>

            {/* Pickup → drop, as a timeline. */}
            <Card padding={18} style={{ borderRadius: 20, borderColor: HAIRLINE, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 6,
                    marginTop: 7,
                    backgroundColor: driverColors.online,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
                    Pickup
                  </Text>
                  <Text style={{ fontSize: 16, lineHeight: 23 }}>
                    {job.pickupAddress ?? 'Location shared by the customer'}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  height: 18,
                  width: 1,
                  marginLeft: 5,
                  borderLeftWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#9CA3AF',
                }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <MapPin
                  size={13}
                  color={theme.colors.error}
                  strokeWidth={2.4}
                  style={{ marginTop: 6 }}
                />
                <View style={{ flex: 1 }}>
                  <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
                    Drop
                  </Text>
                  <Text style={{ fontSize: 16, lineHeight: 23 }}>
                    {job.dropAddress ?? 'No destination set'}
                  </Text>
                </View>
              </View>

              {job.distanceKm !== null ? (
                <View style={{ flexDirection: 'row', paddingTop: 2 }}>
                  <Pill
                    label={`${job.distanceKm} km trip`}
                    bg="#F3F4F6"
                    fg="#374151"
                    radius={7}
                    textSize={13}
                  />
                </View>
              ) : null}
            </Card>

            {job.note ? (
              <Card padding={18} style={{ borderRadius: 20, borderColor: HAIRLINE }}>
                <View style={{ flexDirection: 'row', gap: 11 }}>
                  <MessageCircle size={16} color={INK_SOFT} strokeWidth={2} style={{ marginTop: 3 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, lineHeight: 22 }}>Customer Note</Text>
                    <Text style={{ fontSize: 14, lineHeight: 20, color: INK_SOFT }}>{job.note}</Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {/*
              §5.1's handover, stated and not yet actionable.
              The OTP is held by the CUSTOMER and typed by the driver — it never
              travels to this handset, which is the entire point of it. Saying so
              now stops a driver hunting for a code in this app at the kerbside.
              Phase 18 puts the keypad under this card.
            */}
            {job.otpPending ? (
              <Card
                padding={16}
                style={{
                  borderRadius: 20,
                  borderColor: HAIRLINE,
                  backgroundColor: driverColors.noticeBg,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
                  <Lock size={16} color={driverColors.amber} strokeWidth={2.2} style={{ marginTop: 3 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, lineHeight: 22 }}>Waiting for pickup OTP</Text>
                    <Text style={{ fontSize: 13, lineHeight: 19, color: INK_SOFT }}>
                      The customer will read you a code when you arrive. Ask them for it — it is
                      never sent to your phone.
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

/** A round icon button with a caption — Call / Navigate. */
function ActionChip({
  icon: Icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: typeof Phone;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={() => ({ alignItems: 'center', gap: 4, opacity: disabled ? 0.4 : 1 })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: driverColors.chip.green.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color={driverColors.chip.green.fg} strokeWidth={2.2} />
      </View>
      <Text style={{ fontSize: 12, lineHeight: 16, color: INK_SOFT }}>{label}</Text>
    </Pressable>
  );
}

function AssignedJobSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width="100%" height={104} radius={20} />
      <Skeleton width="100%" height={96} radius={20} />
      <Skeleton width="100%" height={140} radius={20} />
    </View>
  );
}
