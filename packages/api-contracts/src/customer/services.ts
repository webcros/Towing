import { z } from 'zod';
import { serviceTypeSchema } from '../common/enums';
import { vehicleClassSchema } from '../fleet/trucks';

/**
 * `GET /v1/services` — the Appendix B catalogue (§16.2), served from the
 * `services` table rather than the app's static `services.data.ts`.
 *
 * NINE ROWS OVER SIX ENUM VALUES. Appendix B distinguishes car tow, bike tow,
 * flatbed tow and wheel-lift tow; `bookings.service_type` does not, because all
 * four bill as `tow` and differ only in the vehicle class that selects the §7.1
 * or §7.2 slab. The catalogue is therefore presentation plus a
 * (serviceType, vehicleClass) mapping — see `common/enums.ts` for why the enum
 * was not widened.
 */
export const serviceCatalogItemSchema = z.object({
  /**
   * Stable key, e.g. `car_tow`. The apps map it to a bundled icon and copy.
   *
   * Deliberately `string` and not an enum: the catalogue is admin-editable data,
   * and a new row must not require a contract change plus an app release. The
   * client icon map falls back to a generic icon on an unrecognised slug.
   */
  slug: z.string().min(1),
  /** What the booking is billed as. Four tow slugs share `tow`. */
  serviceType: serviceTypeSchema,
  /**
   * The tow class this service implies, or `null` when the customer's own
   * vehicle decides it (§9.1.5 step 1: "vehicle determines class").
   */
  defaultVehicleClass: vehicleClassSchema.nullable(),
  name: z.string().min(1),
  description: z.string(),
  /** Roadside services have no destination; a tow does. Drives §9.1.5's "no drop needed" state. */
  requiresDrop: z.boolean(),
  displayOrder: z.number().int(),
});
export type ServiceCatalogItem = z.infer<typeof serviceCatalogItemSchema>;

/** `GET /v1/services` response — active rows only, already in `displayOrder`. */
export const serviceCatalogResponseSchema = z.array(serviceCatalogItemSchema);
export type ServiceCatalogResponse = z.infer<typeof serviceCatalogResponseSchema>;
