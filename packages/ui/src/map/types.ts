import type { StyleProp, ViewStyle } from 'react-native';
import type { IconComponent } from '../types';

export type MapPreviewProps = {
  height?: number;
  showRecenter?: boolean;
  onRecenter?: () => void;
  recenterDisabled?: boolean;
  recenterIcon?: IconComponent;
  /** Watermark shown by the placeholder implementation. */
  label?: string;
  style?: StyleProp<ViewStyle>;
};
