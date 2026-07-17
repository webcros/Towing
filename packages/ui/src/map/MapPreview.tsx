import { MapPreviewPlaceholder } from './MapPreview.placeholder';

export type { MapPreviewProps } from './types';

/**
 * Map facade. Today it renders the styled placeholder. When Google Maps keys
 * are configured, point this at a react-native-maps implementation
 * (MapPreview.maps) with the same props — no consumer changes required.
 */
export const MapPreview = MapPreviewPlaceholder;
