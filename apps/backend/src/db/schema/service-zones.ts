import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import type { DispatchConfigOverride } from '@towing/api-contracts';
import { geographyPolygon } from '../geography';
import { primaryId, timestamps } from './columns';
import { surgeBandEnum } from './enums';

/**
 * Geofenced operating areas (§6.10, §17 GEOFENCING & DISPATCH CONFIG).
 *
 * Until Phase 14 this table had never been read by a request handler: only
 * `realtime/positions.repo.ts` selected it, for zone outlines on the fleet map.
 * `dispatch_config` had zero writers AND zero readers, `is_highway` was false on
 * every row, and `surge_band` was free text holding the literal 'standard'.
 * Phase 14 makes all three load-bearing — a booking's pickup is point-in-polygon
 * tested here to pick the zone, its surge band, any highway charge and its
 * dispatch radius ladder.
 */
export const serviceZones = pgTable('service_zones', {
  id: primaryId(),
  name: text('name').notNull(),
  // GIST index (`idx_service_zones_geo`) added in migration 0002. Phase 14 is
  // its first user — `zone-resolver.service.ts`'s ST_Covers lookup.
  area: geographyPolygon('area').notNull(),
  /**
   * §7.4 surge tier. Was nullable `text` until migration 0011; every existing
   * row held 'standard', so the cast was free. The estimate multiplies by this,
   * and a free-text typo is a silently un-surged fare.
   */
  surgeBand: surgeBandEnum('surge_band').notNull().default('standard'),
  /** §7.4 highway pickup surcharge applies when the PICKUP falls in a zone with this set. */
  isHighway: boolean('is_highway').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  /**
   * §6.7 per-zone dispatch overrides — radius ladder, offer timing, wave size,
   * per-service variations. Typed by `dispatchConfigOverrideSchema` and read
   * ONLY through `resolveDispatchConfig()`, which supplies the code-level
   * defaults when this is NULL. A consumer reading the JSONB directly and
   * falling back to its own constants is the exact failure Phase 17 is written
   * to avoid.
   *
   * Not to be confused with the `dispatch_config` TABLE, which holds the global
   * scorer weights. See `db/schema/pricing.ts`.
   */
  dispatchConfig: jsonb('dispatch_config').$type<DispatchConfigOverride>(),
  ...timestamps,
});
