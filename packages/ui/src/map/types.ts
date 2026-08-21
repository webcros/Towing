import type { StyleProp, ViewStyle } from 'react-native';
import type { IconComponent } from '../types';

/** A WGS-84 point, in the shape both apps already use for coordinates. */
export type MapCoordinate = { latitude: number; longitude: number };

/**
 * A pin. Deliberately anonymous beyond a `key` and a `tone`.
 *
 * §11.9 forbids identity pre-assignment, so the nearby-driver markers the
 * customer's home screen draws carry no name, plate or rating — and a marker
 * type with fields for them would invite exactly that. When Phase 18 needs a
 * labelled, bearing-rotated driver marker on an ASSIGNED job, it can add one.
 */
export type MapMarker = {
  key: string;
  coordinate: MapCoordinate;
  /**
   * `driver` renders the supply glyph, `pickup`/`drop` the route endpoints,
   * `user` the blue dot. Kept as a closed set rather than a free colour so two
   * screens cannot draw the same concept differently.
   */
  tone: 'driver' | 'pickup' | 'drop' | 'user';
  /**
   * Radius in metres of an uncertainty halo drawn under the marker. §11.9's
   * coarsened positions and §11.3's low-accuracy fixes both use it — a circle
   * sized to the error is honest where a precise dot is not.
   */
  accuracyMeters?: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapPreviewProps = {
  height?: number;
  showRecenter?: boolean;
  onRecenter?: () => void;
  recenterDisabled?: boolean;
  recenterIcon?: IconComponent;
  /** Render the user's position (blue dot + accuracy ring + label pill). */
  showUserLocation?: boolean;
  userLocationLabel?: string;
  /** Vertical position of the user marker; omit to center it in the map. */
  userMarkerTop?: number | `${number}%`;
  /** Watermark shown by the placeholder implementation. */
  label?: string;
  style?: StyleProp<ViewStyle>;

  // --- Phase 16: the real map ---------------------------------------------
  // Every field below is OPTIONAL and ignored by the placeholder, which is what
  // let the native implementation land behind this seam without touching the
  // four screens that already render `<MapPreview />`.

  /** Where to look. Uncontrolled after first render — pass `region` to drive it. */
  initialRegion?: MapRegion;
  /** Controlled camera. Changing it animates; the placeholder ignores it. */
  region?: MapRegion;
  markers?: MapMarker[];
  /**
   * Fit the camera to every marker plus the user, once, after the first frame
   * that has any. NOT continuous: a camera that re-fits on every ping fights the
   * customer's pan, and §11.5's pan-pause/re-center behaviour is Phase 18's.
   */
  fitToMarkers?: boolean;
  /**
   * Fires as the camera starts moving. Paired with `onRegionChangeComplete`
   * because the pin screen has to know the label under the pin is STALE while a
   * pan is in flight — without it the sheet keeps showing the previous address
   * over a map that has already moved, and "Confirm" would accept a point the
   * customer is no longer looking at.
   */
  onRegionChange?: () => void;
  /** Fires after the user stops panning — the draggable-pin screen reads this. */
  onRegionChangeComplete?: (region: MapRegion) => void;
  /** Disables pan/zoom for the decorative cards that are not meant to be driven. */
  interactive?: boolean;
};
