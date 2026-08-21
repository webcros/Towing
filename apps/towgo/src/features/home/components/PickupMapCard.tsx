import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text, Button, MapPreview, type MapMarker, type MapRegion } from '@towing/ui';
import { MapPin, LocateFixed, Navigation } from '@/icons';
import { useLocationStore } from '@/features/location/locationStore';
import { useNearbyDrivers } from '@/features/home/api/home.queries';
import { Pressable } from '@/motion';

export type PickupMapCardProps = {
  onBook: () => void;
  onUseCurrentLocation: () => void;
  locating?: boolean;
  isOnline?: boolean;
  /** Foreground location permission was denied — pickup stays on the fallback address. */
  locationDenied?: boolean;
};

/**
 * ~2.5 km across at Bengaluru's latitude — wide enough to show that supply is
 * spread out, tight enough that a marker is still a place rather than a region.
 */
const HOME_ZOOM_DELTA = 0.022;

/**
 * Home pickup card: live map with the user's position and real nearby supply on
 * top, pickup address + locate below, then the Book a Tow CTA — one card.
 *
 * Phase 16 gave it two things it had been drawing around: a real map behind the
 * `MapPreview` seam, and real §11.9 supply markers. The markers are ANONYMOUS by
 * contract — count and coarsened positions, no name, plate, rating or ETA — so
 * this card can say how much help is nearby without promising a specific driver
 * before dispatch has chosen one.
 */
export function PickupMapCard({
  onBook,
  onUseCurrentLocation,
  locating = false,
  isOnline = true,
  locationDenied = false,
}: PickupMapCardProps) {
  const theme = useTheme();
  const pickup = useLocationStore((s) => s.pickup);

  const { data: supply } = useNearbyDrivers(pickup.coords);

  const region = useMemo<MapRegion | undefined>(
    () =>
      pickup.coords
        ? {
            latitude: pickup.coords.latitude,
            longitude: pickup.coords.longitude,
            latitudeDelta: HOME_ZOOM_DELTA,
            longitudeDelta: HOME_ZOOM_DELTA,
          }
        : undefined,
    [pickup.coords],
  );

  const markers = useMemo<MapMarker[]>(
    () =>
      (supply?.points ?? []).map((point, index) => ({
        // Index-keyed, and that is forced rather than lazy: §11.9's response
        // carries no driver id by design, so there is nothing stabler to key on.
        // The list is small and fully replaced on each poll, so React's
        // reconciliation has nothing to get wrong.
        key: `driver-${index}`,
        coordinate: point,
        tone: 'driver',
        // The halo is the coarsening made visible. A precise dot would claim a
        // precision the ~100 m grid snap deliberately removed, and a customer
        // who walked to it would find nobody there.
        accuracyMeters: supply?.coarsenedToMeters,
      })),
    [supply],
  );

  return (
    <Card radius="cardLg" padding={0} style={{ overflow: 'hidden' }}>
      <MapPreview
        height={206}
        showUserLocation
        recenterIcon={Navigation}
        onRecenter={onUseCurrentLocation}
        recenterDisabled={!isOnline || locating}
        region={region}
        markers={markers}
        // Not interactive: this is a summary card with a CTA under it, and a map
        // that pans here would fight the screen's own scroll. Panning belongs on
        // the full-screen picker.
        interactive={false}
      />

      <View style={{ paddingVertical: 18, paddingHorizontal: 16, gap: 18 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, gap: 7 }}>
            <Text variant="overline" color="tertiary">
              Pickup Location
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <MapPin size={18} color={theme.colors.brand} />
              <Text
                weight="semibold"
                numberOfLines={1}
                style={{ fontSize: 16, lineHeight: 22, flexShrink: 1 }}
              >
                {pickup.label}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onUseCurrentLocation}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            style={() => ({
              width: 36,
              height: 36,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {locating ? (
              <ActivityIndicator size="small" color={theme.colors.brand} />
            ) : (
              <LocateFixed size={16} color={theme.colors.textSecondary} />
            )}
          </Pressable>
        </View>

        {locationDenied ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MapPin size={13} color={theme.colors.error} />
            <Text color="error" style={{ fontSize: 12, lineHeight: 16, flex: 1 }}>
              Location access denied — using your last saved pickup instead.
            </Text>
          </View>
        ) : null}

        {/*
          Rendered only once the count is KNOWN. A "0 drivers nearby" flashed
          during the first load would tell the customer there is no help
          available at the exact moment they are deciding whether to ask for it.
        */}
        {supply ? <SupplyLine count={supply.count} /> : null}

        <Button label="Book a Tow" onPress={onBook} fullWidth height={46} />
      </View>
    </Card>
  );
}

/**
 * The honest supply number — taken before coarsening collapsed co-located
 * drivers into single markers, so it can legitimately read higher than the pins
 * on the map.
 */
function SupplyLine({ count }: { count: number }) {
  const theme = useTheme();
  const none = count === 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: none ? theme.colors.textTertiary : theme.colors.success,
        }}
      />
      <Text color={none ? 'secondary' : 'primary'} style={{ fontSize: 13, lineHeight: 18 }}>
        {none
          ? 'No trucks nearby right now — you can still book'
          : `${count} tow truck${count === 1 ? '' : 's'} nearby`}
      </Text>
    </View>
  );
}
