import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PlacePrediction } from '@towing/api-contracts';
import { useTheme } from '@towing/theme';
import { Text, Button, isNativeMapAvailable } from '@towing/ui';
import { ArrowLeft } from '@/icons';
import { useBookingStore } from '@/features/booking/store/bookingStore';
import { LocationFields, type LocationField } from '@/features/booking/components/LocationFields';
import { BookingPills } from '@/features/booking/components/BookingPills';
import { LocationActionButtons } from '@/features/booking/components/LocationActionButtons';
import { PlaceSuggestionsList } from '@/features/booking/components/PlaceSuggestionsList';
import { RecentLocationsList } from '@/features/booking/components/RecentLocationsList';
import { usePlaceAutocomplete, resolvePlace } from '@/features/places/api/places.queries';
import { useLocationStore } from '@/features/location/locationStore';
import type { RecentLocation } from '@/features/booking/data/recentLocations.data';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

/**
 * §9.1.5 step 1 — where from, where to.
 *
 * PHASE 16 CLOSED THE LARGEST HOLE IN THE CUSTOMER APP HERE. Until now a
 * customer could only book to one of seven presets: `LocationFields` was a plain
 * `TextInput` whose text nothing resolved, and "Select on map" was wired to an
 * empty `notReady`. Both are real now — typing searches, and the pin opens a
 * full-screen map.
 *
 * THE COORDINATE MOVES WITH THE LABEL, ALWAYS. That rule predates this screen's
 * autocomplete (Phase 14 wrote it into `onSelectRecent`) and is why picking a
 * suggestion resolves its coordinate before setting the address rather than
 * after: setting the string alone would leave the fare engine pricing the
 * previous destination under the new name.
 */
export function BookLocationScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const pickupAddress = useBookingStore((s) => s.pickupAddress);
  const dropAddress = useBookingStore((s) => s.dropAddress);
  const setPickupAddress = useBookingStore((s) => s.setPickupAddress);
  const setDropAddress = useBookingStore((s) => s.setDropAddress);
  const setPickupCoords = useBookingStore((s) => s.setPickupCoords);
  const setDropCoords = useBookingStore((s) => s.setDropCoords);
  const pickupPoint = useLocationStore((s) => s.pickup.coords);

  /**
   * Which field the customer is editing.
   *
   * REAL STATE NOW, NOT A REF. It used to be a `useRef` plus a `force((n) =>
   * n + 1)` counter, because nothing rendered from it — a tapped recent just
   * needed somewhere to go. The suggestion list is driven by it (which field's
   * text is being searched, and which one a result fills), so it has to
   * participate in rendering.
   */
  const [activeField, setActiveField] = useState<LocationField>(pickupAddress ? 'drop' : 'pickup');
  const [resolving, setResolving] = useState(false);
  const [outsideZone, setOutsideZone] = useState<string | null>(null);
  /**
   * The label most recently written into a field by a SELECTION.
   *
   * Picking a suggestion sets the field's text to the resolved label, which is
   * also the autocomplete query — so without this the screen immediately
   * searches for the address the customer just chose and re-opens the
   * suggestion list underneath it, one entry deep. Suppressing while the text
   * still equals the picked label fixes it and clears itself the moment they
   * edit, because the comparison stops matching.
   */
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  const query = activeField === 'pickup' ? pickupAddress : dropAddress;
  const { data, isFetching, isError } = usePlaceAutocomplete(query, pickupPoint);
  const predictions = data?.predictions ?? [];

  const apply = useCallback(
    (field: LocationField, label: string, point: { latitude: number; longitude: number }) => {
      setPickedLabel(label);
      if (field === 'pickup') {
        setPickupAddress(label);
        setPickupCoords(point);
        // Move straight on to the destination — the overwhelmingly common next
        // action, and the behaviour the recents list already had.
        setActiveField('drop');
      } else {
        setDropAddress(label);
        setDropCoords(point);
      }
    },
    [setPickupAddress, setDropAddress, setPickupCoords, setDropCoords],
  );

  const onSelectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      setResolving(true);
      setOutsideZone(null);
      try {
        const place = await resolvePlace(prediction.placeId);
        apply(activeField, place.label, {
          latitude: place.point.lat,
          longitude: place.point.lng,
        });
        /**
         * §9.1.5's "outside our service area", surfaced AT SELECTION rather than
         * at the fare sheet. The estimate would 422 on it anyway — this just
         * means the customer finds out one tap in instead of after choosing a
         * service and a time.
         */
        if (place.zoneId === null) {
          setOutsideZone(`We don’t operate around ${place.label} yet.`);
        }
      } catch {
        // A failed resolve leaves the field exactly as it was. Writing the label
        // without its coordinate is the one outcome that must not happen: the
        // fare would then be priced against the previous destination.
        setOutsideZone('Couldn’t use that address. Try another, or pick it on the map.');
      } finally {
        setResolving(false);
      }
    },
    [activeField, apply],
  );

  const onSelectRecent = useCallback(
    (loc: RecentLocation) => {
      // The coordinate moves with the label here too — see the header.
      apply(activeField, `${loc.name}, ${loc.address.split(',')[0]}`, loc.coords);
      setOutsideZone(null);
    },
    [activeField, apply],
  );

  const onSelectOnMap = useCallback(() => {
    navigation.navigate('MapPicker', { field: activeField });
  }, [navigation, activeField]);

  const notReady = useCallback(() => {}, []);
  const canContinue = pickupAddress.trim().length > 0 && dropAddress.trim().length > 0;
  // Below three characters the query hook stays disabled, so the suggestion list
  // must stay hidden rather than render an "empty" state for a search that never
  // ran. Same threshold, read from the same place it is enforced. The second
  // clause is the just-picked suppression — see `pickedLabel`.
  const searching = query.trim().length >= 3 && query !== pickedLabel;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 12,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <ArrowLeft size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <Text weight="bold" style={{ fontSize: 22, lineHeight: 28 }}>
            Enter location
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <BookingPills />
          <LocationFields onFocusField={setActiveField} />
          <LocationActionButtons
            onSelectOnMap={onSelectOnMap}
            // A pin over the themed placeholder would let the customer confirm a
            // pickup they cannot actually see. Until a Maps key exists on
            // Android the button is disabled rather than misleading.
            selectOnMapDisabled={!isNativeMapAvailable()}
            onAddStops={notReady}
          />

          {outsideZone ? (
            <Text color="error" style={{ fontSize: 13, lineHeight: 18 }}>
              {outsideZone}
            </Text>
          ) : null}
        </View>

        {/* Suggestions while typing; recents otherwise. */}
        <ScrollView
          style={{ flex: 1, marginTop: 6 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {searching ? (
            <PlaceSuggestionsList
              predictions={predictions}
              // The spinner replaces the list only when there is nothing to
              // show. `placeholderData` keeps the previous suggestions on screen
              // between keystrokes, and swapping them for a spinner on every
              // refetch would throw that away and make the list flicker — which
              // is the whole reason the query keeps them.
              isLoading={(isFetching && predictions.length === 0) || resolving}
              isError={isError}
              hasQuery
              onSelect={(prediction) => void onSelectPrediction(prediction)}
              // The server labels a degraded or key-less answer; the customer is
              // told their address might simply not be searchable yet rather
              // than that it does not exist.
              limitedCoverage={data?.source === 'local'}
            />
          ) : (
            <RecentLocationsList onSelect={onSelectRecent} />
          )}
        </ScrollView>

        {/* Continue */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface0,
          }}
        >
          <Button
            label="Continue"
            fullWidth
            height={50}
            disabled={!canContinue}
            onPress={() => navigation.navigate('BookTow')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
