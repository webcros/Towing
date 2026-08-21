import type { ImageSourcePropType } from 'react-native';
import { BatteryCharging, Bike, CarFront, LifeBuoy, Fuel, Truck, Wrench } from '@/icons';
import type { IconComponent } from '@towing/ui';

/**
 * Artwork for a `services.slug`, and all that remains of the old
 * `services.data.ts`.
 *
 * THE CATALOGUE ITSELF NOW COMES FROM `GET /v1/services` (§16.2). What a bundled
 * array can legitimately own is the artwork — a `require()`d PNG or a curated
 * Lucide glyph cannot come down a wire — so this maps slug → image and the
 * server supplies the name, the description, the order and whether the row is
 * still active.
 *
 * TWO SERVICES DISAPPEARED IN THE SWAP, and that is the correction, not a
 * regression. The static list carried `lockout` ("Lockout Assistance") and
 * `winch_out` ("Winch Out"); neither is in Appendix B, neither has a
 * `service_type`, and neither has a §7 fare — the app was advertising two
 * services the platform cannot price, quote or dispatch. It was also missing
 * four that Appendix B does define (bike tow, flatbed tow, wheel-lift tow,
 * breakdown, accident recovery) and its six ids matched the backend enum on
 * exactly zero of them.
 *
 * An unknown slug falls back to `Wrench` rather than rendering nothing, so an
 * admin adding a catalogue row does not need an app release to make it visible.
 */
export interface ServiceArtwork {
  icon?: IconComponent;
  image?: ImageSourcePropType;
}

const ARTWORK: Record<string, ServiceArtwork> = {
  car_tow: { image: require('@/assets/icons/qa-tow.png') },
  bike_tow: { icon: Bike },
  flatbed_tow: { icon: Truck },
  wheel_lift_tow: { icon: CarFront },
  battery: { icon: BatteryCharging },
  flat_tyre: { icon: LifeBuoy },
  fuel: { icon: Fuel },
  breakdown: { icon: Wrench },
  accident_recovery: { icon: Truck },
};

export function artworkFor(slug: string): ServiceArtwork {
  return ARTWORK[slug] ?? { icon: Wrench };
}
