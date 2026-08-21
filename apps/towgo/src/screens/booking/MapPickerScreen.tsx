import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Button, MapPreview, Text, type MapRegion } from '@towing/ui';
import { ArrowLeft, MapPin } from '@/icons';
import { useBookingStore } from '@/features/booking/store/bookingStore';
import { useLocationStore } from '@/features/location/locationStore';
import { useReverseGeocode } from '@/features/places/api/places.queries';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

/**
 * §9.1.5 step 2 — the draggable pin.
 *
 * "Select on map" has been a dead button since Phase 12 and was re-homed here
 * from Phase 15 for one reason: a pin needs a rendered map underneath it, which
 * is what this phase installs.
 *
 * THE PIN DOES NOT MOVE; THE MAP DOES. The marker is a fixed overlay at the
 * screen's centre and the customer pans the world beneath it, which is how every
 * ride-hailing app does this and is not merely convention: a genuinely draggable
 * marker has to be grabbed accurately with a thumb that then covers it, and it
 * cannot be positioned near the screen edge at all. Reading the camera's centre
 * on settle also means there is exactly one source of truth for "where the pin
 * is" — no gesture state to keep in sync with a coordinate.
 */
export function MapPickerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'MapPicker'>>();
  const field = params?.field ?? 'pickup';

  const setPickupAddress = useBookingStore((s) => s.setPickupAddress);
  const setDropAddress = useBookingStore((s) => s.setDropAddress);
  const setPickupCoords = useBookingStore((s) => s.setPickupCoords);
  const setDropCoords = useBookingStore((s) => s.setDropCoords);
  const storePickup = useBookingStore((s) => s.pickupCoords);
  const storeDrop = useBookingStore((s) => s.dropCoords);
  const deviceLocation = useLocationStore((s) => s.pickup.coords);

  /**
   * Opens on the point being edited, falling back to the other end of the trip
   * and then to the device — so a customer correcting a drop starts at the drop,
   * not back at their own doorstep 20 km away.
   */
  const initialPoint = (field === 'pickup' ? storePickup : storeDrop) ?? deviceLocation ?? storePickup;

  const initialRegion = useRef<MapRegion>({
    latitude: initialPoint.latitude,
    longitude: initialPoint.longitude,
    // ~500 m across: close enough that the pin is placed on a building rather
    // than a neighbourhood, which is the whole point of dropping one.
    latitudeDelta: 0.0045,
    longitudeDelta: 0.0045,
  }).current;

  const [centre, setCentre] = useState({
    latitude: initialPoint.latitude,
    longitude: initialPoint.longitude,
  });
  /** True between the first pan and the camera settling — the label is stale meanwhile. */
  const [moving, setMoving] = useState(false);

  const { data: place, isFetching } = useReverseGeocode(centre);

  /**
   * The label under the pin goes stale the instant the map starts moving, and
   * saying so is the difference between a picker that feels precise and one
   * that appears to lag. Without this the sheet keeps showing the previous
   * address over a map that has already moved, and "Confirm" would accept a
   * point the customer is no longer looking at.
   */
  const onRegionChangeStart = useCallback(() => setMoving(true), []);

  const onRegionChangeComplete = useCallback((region: MapRegion) => {
    setMoving(false);
    setCentre({ latitude: region.latitude, longitude: region.longitude });
  }, []);

  const onConfirm = useCallback(() => {
    // The label may be absent (reverse geocode in flight or failed); the
    // COORDINATE never is, and it is the half that prices the trip. Falling back
    // to a formatted coordinate keeps the field honest rather than blank.
    const label = place?.label ?? `${centre.latitude.toFixed(5)}, ${centre.longitude.toFixed(5)}`;

    if (field === 'pickup') {
      setPickupAddress(label);
      setPickupCoords(centre);
    } else {
      setDropAddress(label);
      setDropCoords(centre);
    }
    navigation.goBack();
  }, [place, centre, field, setPickupAddress, setDropAddress, setPickupCoords, setDropCoords, navigation]);

  const outsideZone = place !== undefined && place.zoneId === null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <MapPreview
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChange={onRegionChangeStart}
        onRegionChangeComplete={onRegionChangeComplete}
        showRecenter={false}
        showUserLocation
        userLocationLabel=""
      />

      {/*
        The pin, pinned. `pointerEvents: none` is load-bearing — an overlay that
        swallowed touches would make the map underneath undraggable, which is the
        one thing this screen exists to do.
      */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <MapPin
          size={38}
          color={theme.colors.brand}
          // Anchored so the point of the pin sits on the camera centre rather
          // than the icon's middle — otherwise the confirmed coordinate is half
          // an icon north of where it looks.
          style={{ marginBottom: 38 }}
        />
      </View>

      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={() => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            marginLeft: 16,
            backgroundColor: theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.fab,
          })}
        >
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 14,
            gap: 14,
            ...theme.shadows.card,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text variant="overline" color="tertiary">
              {field === 'pickup' ? 'Pickup Location' : 'Drop Location'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 }}>
              {moving || isFetching ? (
                <ActivityIndicator size="small" color={theme.colors.brand} />
              ) : (
                <MapPin size={17} color={theme.colors.brand} />
              )}
              <Text weight="semibold" numberOfLines={2} style={{ fontSize: 15, lineHeight: 21, flex: 1 }}>
                {moving ? 'Move the map to set the point' : (place?.address ?? 'Locating…')}
              </Text>
            </View>
          </View>

          {outsideZone ? (
            <Text color="error" style={{ fontSize: 13, lineHeight: 18 }}>
              We don’t operate here yet — pick a point inside a service area.
            </Text>
          ) : null}

          <Button
            label={field === 'pickup' ? 'Confirm pickup' : 'Confirm drop'}
            fullWidth
            height={50}
            // Blocked only while the camera is in flight. An unresolved LABEL is
            // fine — the coordinate is what the trip is priced from — but an
            // unsettled camera means the point under the pin is still changing.
            disabled={moving}
            onPress={onConfirm}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
