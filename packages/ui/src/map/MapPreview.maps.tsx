import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '@towing/theme';
import { Text } from '../Text';
import type { MapMarker, MapPreviewProps, MapRegion } from './types';

/**
 * The real map (Phase 16), behind the `MapPreviewProps` seam the placeholder
 * has always implemented.
 *
 * WHICH PROVIDER, AND WHY IT MATTERS HERE MORE THAN USUAL. On iOS this uses
 * `PROVIDER_DEFAULT` — Apple Maps — which needs no key and no billing account,
 * so the customer map is fully real on iOS today. On Android there is no
 * keyless option: Google Maps is the only provider and a missing key renders a
 * blank grey grid with the Google watermark. That asymmetry is exactly why
 * `MapPreview.tsx` gates on the key rather than rendering this unconditionally.
 *
 * NEVER OBSERVED ON A DEVICE. `react-native-maps` is a native module and no dev
 * client has ever been built for either app, so this file is typechecked,
 * bundle-clean and prebuild-clean — and has not been seen to draw a single tile.
 * Same honest standing as Phase 13's push adapters.
 */

/** One frame's worth of camera, when nothing else says where to look. */
const FALLBACK_REGION: MapRegion = {
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function MapPreviewMaps({
  height,
  showRecenter = true,
  onRecenter,
  recenterDisabled = false,
  recenterIcon: RecenterIcon,
  showUserLocation = false,
  userLocationLabel = 'You are here',
  style,
  initialRegion,
  region,
  markers,
  fitToMarkers = false,
  onRegionChange,
  onRegionChangeComplete,
  interactive = true,
}: MapPreviewProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const [ready, setReady] = useState(false);
  const hasFitted = useRef(false);

  /**
   * Controlled camera moves are ANIMATED rather than passed as `region`.
   *
   * `react-native-maps` treats a `region` prop as fully controlled: every render
   * snaps the camera back, so a user mid-pan is yanked to the last prop value
   * and the map feels broken. Animating from an imperative effect leaves the
   * gesture in charge, which is what a map has to do.
   */
  useEffect(() => {
    if (!region || !ready) return;
    mapRef.current?.animateToRegion(region, 350);
  }, [region, ready]);

  /**
   * ONE-SHOT, and the ref is the whole reason.
   *
   * Nearby drivers refresh every few seconds. Re-fitting on each batch would
   * re-frame the camera under the customer's finger and undo any pan or zoom
   * they had just made — the §11.5 pan-pause and re-center chip that solves this
   * properly are Phase 18's, so until then the honest behaviour is to frame once
   * and then leave the map alone.
   */
  useEffect(() => {
    if (!fitToMarkers || !ready || hasFitted.current) return;
    const coordinates = (markers ?? []).map((marker) => marker.coordinate);
    if (coordinates.length === 0) return;

    hasFitted.current = true;
    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 64, right: 64, bottom: 64, left: 64 },
      animated: true,
    });
  }, [fitToMarkers, markers, ready]);

  const onMapReady = useCallback(() => setReady(true), []);

  const handleRegionChangeComplete = useCallback(
    (next: MapRegion) => onRegionChangeComplete?.(next),
    [onRegionChangeComplete],
  );

  return (
    <View
      style={[
        {
          height: height ?? undefined,
          backgroundColor: theme.colors.mapBg,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Apple Maps on iOS (keyless); Google is the only Android option.
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion ?? region ?? FALLBACK_REGION}
        onMapReady={onMapReady}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        // Ours is drawn by the consumer, positioned against the sheet.
        showsCompass={false}
        toolbarEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        // Renders inside a Card with `overflow: hidden` on several screens;
        // without this Android draws the map over the rounded corners.
        loadingEnabled
        loadingBackgroundColor={theme.colors.mapBg}
      >
        {(markers ?? []).map((marker) => (
          <MarkerPin key={marker.key} marker={marker} />
        ))}
      </MapView>

      {showUserLocation && userLocationLabel ? (
        <View pointerEvents="none" style={styles.labelWrap}>
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radii.pill,
              paddingHorizontal: 12,
              paddingVertical: 6,
              ...theme.shadows.fab,
            }}
          >
            <Text weight="medium" style={{ fontSize: 12, lineHeight: 16, color: theme.colors.info }}>
              {userLocationLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {showRecenter ? (
        <Pressable
          onPress={onRecenter}
          disabled={recenterDisabled}
          accessibilityRole="button"
          accessibilityLabel="Re-center map"
          accessibilityState={{ disabled: recenterDisabled }}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.colors.fabBg,
            alignItems: 'center',
            justifyContent: 'center',
            // No alpha: this node carries elevation, and on Android the shadow
            // is drawn outside the view's own alpha, so fading it makes the
            // shadow show through. Dim the glyph instead.
            ...theme.shadows.fab,
          }}
        >
          {RecenterIcon ? (
            <RecenterIcon
              size={18}
              color={recenterDisabled ? theme.colors.textTertiary : theme.colors.textSecondary}
            />
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A pin plus, when the position is uncertain, a halo sized to that uncertainty.
 *
 * The halo is not decoration. A §11.9 nearby-driver marker is snapped onto a
 * ~100 m grid and a §11.3 low-accuracy fix can be worse; drawing either as a
 * precise dot claims a precision the data does not have, and a customer who
 * walks to the dot finds nobody there.
 */
function MarkerPin({ marker }: { marker: MapMarker }) {
  const theme = useTheme();

  const fill = {
    driver: theme.colors.brand,
    pickup: theme.colors.success,
    drop: theme.colors.error,
    user: theme.colors.info,
  }[marker.tone];

  return (
    <>
      {marker.accuracyMeters ? (
        <Circle
          center={marker.coordinate}
          radius={marker.accuracyMeters}
          strokeColor="transparent"
          fillColor={theme.colors.infoSoftBg}
        />
      ) : null}
      <Marker
        coordinate={marker.coordinate}
        // `tracksViewChanges` defaults to true, which re-rasterises every custom
        // marker on every render. With a screenful of drivers refreshing every
        // few seconds that is the single biggest frame-rate cost in the library.
        tracksViewChanges={false}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View
          style={{
            width: marker.tone === 'driver' ? 18 : 16,
            height: marker.tone === 'driver' ? 18 : 16,
            borderRadius: 9,
            backgroundColor: fill,
            borderWidth: 3,
            borderColor: theme.colors.card,
          }}
        />
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
