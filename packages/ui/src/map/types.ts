import type { StyleProp, ViewStyle } from 'react-native';
import type { IconComponent } from '../types';

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
};
