import type { ImageSourcePropType } from 'react-native';

export type TowTypeId = 'light' | 'medium' | 'heavy' | 'euro';

export type TowType = {
  id: TowTypeId;
  name: string;
  categories: string;
  /**
   * Which §7 base matrix this duty class bills against — §7.1 wheel-lift or
   * §7.2 flatbed. This replaced the hardcoded `price`/`comparePrice` fields in
   * Phase 14: a tow type is a VEHICLE CLASS, not a price. The number now comes
   * from `POST /v1/pricing/estimate`, which needs the distance and the zone
   * that a static array cannot know.
   */
  vehicleClass: 'wheel_lift' | 'flatbed';
  image: ImageSourcePropType;
  /** Rendered dimmed and unselectable (e.g. not yet available). */
  disabled?: boolean;
};
