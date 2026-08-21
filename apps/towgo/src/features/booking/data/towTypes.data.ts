import type { TowType } from '../types';

/**
 * The four duty classes (Figma 31:66), as PRESENTATION over §7's two vehicle
 * classes.
 *
 * The prices that used to live here are gone. Their own comment said they
 * "become the estimate API later (spec §7.6 — fare matrix by vehicle class +
 * distance)" — Phase 14 is later. What a static array can legitimately own is
 * the artwork, the label and which base matrix the class bills against; what it
 * cannot own is a fare, because §7 needs the distance and the zone.
 *
 * `image` stays `ImageSourcePropType`: bundled artwork is correctly a
 * `require()`, and the Phase 12 contract-correction that swapped image props
 * for URL strings applies to SERVER-sourced images only.
 */
export const towTypes: TowType[] = [
  {
    id: 'light',
    name: 'Light Duty',
    categories: 'Cars, Hatchbacks',
    vehicleClass: 'wheel_lift',
    image: require('@/assets/illustrations/tow-light.png'),
  },
  {
    id: 'medium',
    name: 'Medium Duty',
    categories: 'SUVs, MUVs',
    // An SUV goes on a flatbed (§7.2 names "luxury, SUV, EV") — this is the
    // boundary between the two base matrices, not a cosmetic tier.
    vehicleClass: 'flatbed',
    image: require('@/assets/illustrations/tow-medium.png'),
  },
  {
    id: 'heavy',
    name: 'Heavy Duty',
    categories: 'Trucks, Buses',
    vehicleClass: 'flatbed',
    image: require('@/assets/illustrations/tow-heavy.png'),
  },
  {
    id: 'euro',
    name: 'Euro Duty',
    categories: 'Rigs',
    vehicleClass: 'flatbed',
    image: require('@/assets/illustrations/tow-heavy.png'),
    disabled: true,
  },
];

/** The §7 base matrix a duty class bills against. Falls back to the light class. */
export function vehicleClassFor(id: TowType['id']): 'wheel_lift' | 'flatbed' {
  return towTypes.find((type) => type.id === id)?.vehicleClass ?? 'wheel_lift';
}
