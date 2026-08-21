import { Inject, Injectable } from '@nestjs/common';
import {
  resolveDispatchConfig,
  type DispatchConfig,
  type GeoPoint,
  type ServiceType,
  type SurgeBand,
} from '@towing/api-contracts';
import { and, eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { serviceZones } from '../../db/schema';

/**
 * §6.10 geofencing — "a booking's pickup is point-in-polygon tested to pick the
 * zone, its surge band, any highway charge, and its dispatch radius ladder".
 *
 * THE FIRST POINT-IN-POLYGON IN THE REPO. `idx_service_zones_geo`, a GIST index
 * on `service_zones.area`, has existed since migration 0002 and had no query to
 * serve until now; `service_zones` itself had never been read by a request
 * handler.
 *
 * `ST_Covers`, NOT `ST_Contains`. On geography, `ST_Covers` is the operator with
 * an index-accelerated implementation, and — unlike `ST_Contains` — it treats a
 * point exactly ON the boundary as inside. Two adjacent city zones share an
 * edge; a pickup pinned on that edge must resolve to a zone rather than to
 * "outside our service area", which is what §9.1.5's "pin moved outside zone"
 * error would otherwise tell a customer standing in the middle of Bengaluru.
 *
 * ORDERED, BECAUSE OVERLAP IS POSSIBLE. Nothing stops an admin drawing a
 * highway corridor across a city polygon — the seed does exactly that. A
 * highway zone wins, because the §7.4 surcharge is the more specific fact about
 * that pickup; ties after that break on the smaller area, i.e. the more precise
 * geofence.
 */
export interface ResolvedZone {
  id: string;
  name: string;
  surgeBand: SurgeBand;
  isHighway: boolean;
  /** Already merged with the code-level defaults — never raw JSONB. */
  dispatch: DispatchConfig;
}

@Injectable()
export class ZoneResolverService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * The zone containing `point`, or `null` when the platform does not operate
   * there. Callers turn `null` into a 422 rather than pricing anyway — a fare
   * quoted outside every zone has no surge band, no ladder and nobody to
   * dispatch.
   */
  async resolve(point: GeoPoint, service?: ServiceType): Promise<ResolvedZone | null> {
    const rows = await this.db
      .select({
        id: serviceZones.id,
        name: serviceZones.name,
        surgeBand: serviceZones.surgeBand,
        isHighway: serviceZones.isHighway,
        dispatchConfig: serviceZones.dispatchConfig,
      })
      .from(serviceZones)
      .where(
        and(
          eq(serviceZones.isActive, true),
          sql`ST_Covers(${serviceZones.area}, ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography)`,
        ),
      )
      .orderBy(
        sql`${serviceZones.isHighway} DESC`,
        sql`ST_Area(${serviceZones.area}) ASC`,
      )
      .limit(1);

    const zone = rows[0];
    if (!zone) return null;

    return {
      id: zone.id,
      name: zone.name,
      surgeBand: zone.surgeBand,
      isHighway: zone.isHighway,
      // The ONLY sanctioned reader of the JSONB. A caller reaching into
      // `zone.dispatchConfig` itself would have to re-invent the NULL handling,
      // which is how a matcher ends up with hard-coded constants.
      dispatch: resolveDispatchConfig(zone.dispatchConfig, service),
    };
  }
}
