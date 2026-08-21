import { Inject, Injectable } from '@nestjs/common';
import type { FleetId } from '@towing/api-contracts';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import { bookings, drivers, fleetTrucks, serviceZones } from '../db/schema';
import { ACTIVE_JOB_STATUSES } from '../modules/bookings/booking-state-machine.service';

/** Same set `DashboardService` calls active — a truck on one of these is "on job". */

export interface TruckRow {
  truckId: string;
  plate: string;
  status: 'active' | 'inactive' | 'non_compliant';
  driverName: string | null;
  lat: number | null;
  lng: number | null;
  lastPingAt: Date | null;
  activeBookingId: string | null;
  /** Pickup/drop of the active job — the straight leg the map draws. */
  pickupLat: number | null;
  pickupLng: number | null;
  dropLat: number | null;
  dropLng: number | null;
}

export interface ZoneRow {
  id: string;
  name: string;
  geometry: unknown;
}

@Injectable()
export class PositionsRepo {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Every truck this fleet owns, with its last PERSISTED position.
   *
   * This is the authoritative id set for the snapshot. Redis is only ever
   * allowed to make these rows fresher — never to add a truck. Reading the GEO
   * set first would let a stale or poisoned key inject another tenant's truck
   * into this response.
   *
   * `activeBookingId` goes booking → driver → `drivers.assigned_truck_id`,
   * because bookings do not carry a truck id (the same honest proxy the
   * dashboard's utilization uses).
   */
  async trucksFor(fleetId: FleetId): Promise<TruckRow[]> {
    const rows = await this.db
      .select({
        truckId: fleetTrucks.id,
        plate: fleetTrucks.plate,
        status: fleetTrucks.status,
        driverName: drivers.name,
        // ST_X/ST_Y rather than the geographyPoint customType: this select
        // aliases columns, and a nullable custom type would need decoding
        // guards at every call site for no gain.
        lng: sql<number | null>`ST_X(${fleetTrucks.currentLocation}::geometry)`,
        lat: sql<number | null>`ST_Y(${fleetTrucks.currentLocation}::geometry)`,
        lastPingAt: fleetTrucks.lastPingAt,
        activeBookingId: sql<string | null>`${bookings.id}`,
        pickupLat: sql<number | null>`${bookings.pickupLat}`,
        pickupLng: sql<number | null>`${bookings.pickupLng}`,
        dropLat: sql<number | null>`${bookings.dropLat}`,
        dropLng: sql<number | null>`${bookings.dropLng}`,
      })
      .from(fleetTrucks)
      .leftJoin(drivers, eq(drivers.assignedTruckId, fleetTrucks.id))
      .leftJoin(
        bookings,
        and(
          eq(bookings.driverId, drivers.id),
          eq(bookings.fleetId, fleetId),
          inArray(bookings.status, [...ACTIVE_JOB_STATUSES]),
        ),
      )
      .where(eq(fleetTrucks.fleetId, fleetId));

    // A driver can hold at most one active booking in practice, but the left
    // join cannot promise it — dedupe so one truck is never two markers.
    const byTruck = new Map<string, TruckRow>();
    for (const row of rows) {
      const existing = byTruck.get(row.truckId);
      if (existing && existing.activeBookingId !== null) continue;
      byTruck.set(row.truckId, {
        truckId: row.truckId,
        plate: row.plate,
        status: row.status,
        driverName: row.driverName ?? null,
        lat: row.lat === null ? null : Number(row.lat),
        lng: row.lng === null ? null : Number(row.lng),
        lastPingAt: row.lastPingAt ?? null,
        activeBookingId: row.activeBookingId ?? null,
        pickupLat: row.pickupLat === null ? null : Number(row.pickupLat),
        pickupLng: row.pickupLng === null ? null : Number(row.pickupLng),
        dropLat: row.dropLat === null ? null : Number(row.dropLat),
        dropLng: row.dropLng === null ? null : Number(row.dropLng),
      });
    }
    return [...byTruck.values()];
  }

  /**
   * Active service zones as GeoJSON. The vendorless basemap draws these so the
   * map shows real operating geography instead of an empty rectangle, and they
   * back the §9.3.3 zone filter.
   *
   * Not fleet-scoped, because `service_zones` is not: it is platform coverage
   * geography with no `fleet_id` column, the same set every fleet dispatches
   * into. Nothing tenant-specific is exposed by drawing it.
   */
  async activeZones(): Promise<ZoneRow[]> {
    const rows = await this.db
      .select({
        id: serviceZones.id,
        name: serviceZones.name,
        geojson: sql<string>`ST_AsGeoJSON(${serviceZones.area}::geometry)`,
      })
      .from(serviceZones)
      .where(eq(serviceZones.isActive, true));

    return rows.flatMap((row) => {
      try {
        return [{ id: row.id, name: row.name, geometry: JSON.parse(row.geojson) as unknown }];
      } catch {
        // A zone we cannot render is not worth failing the whole snapshot for.
        return [];
      }
    });
  }
}
