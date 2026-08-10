import { Inject, Injectable } from '@nestjs/common';
import type { FleetId, JobsQuery } from '@towing/api-contracts';
import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { bookings, drivers, fleetTrucks } from '../../db/schema';
import type { JobsCursor } from './jobs.cursor';

export interface JobFeedRow {
  booking: typeof bookings.$inferSelect;
  driverName: string | null;
  truckPlate: string | null;
}

const DAY_MS = 86_400_000;

@Injectable()
export class JobsRepo {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Keyset feed matching `idx_bookings_fleet_feed (fleet_id, created_at DESC,
   * id DESC)`. The row-comparison predicate is what lets Postgres walk the
   * index directly instead of sorting.
   */
  async feedPage(
    fleetId: FleetId,
    filters: Pick<JobsQuery, 'status' | 'from' | 'to'>,
    cursor: JobsCursor | undefined,
    limit: number,
  ): Promise<JobFeedRow[]> {
    const conditions: SQL[] = [eq(bookings.fleetId, fleetId)];

    if (filters.status) conditions.push(eq(bookings.status, filters.status));
    if (filters.from) conditions.push(gte(bookings.createdAt, new Date(filters.from)));
    if (filters.to) {
      // Inclusive date bound: everything before the day AFTER `to`.
      conditions.push(lt(bookings.createdAt, new Date(new Date(filters.to).getTime() + DAY_MS)));
    }
    if (cursor) {
      // toISOString: raw sql params bypass drizzle's Date mapping.
      conditions.push(
        sql`(${bookings.createdAt}, ${bookings.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
      );
    }

    const rows = await this.db
      .select({
        booking: bookings,
        driverName: drivers.name,
        truckPlate: fleetTrucks.plate,
      })
      .from(bookings)
      .leftJoin(drivers, eq(drivers.id, bookings.driverId))
      .leftJoin(fleetTrucks, eq(fleetTrucks.id, drivers.assignedTruckId))
      .where(and(...conditions))
      // NULLS LAST explicitly: drizzle-kit emitted the feed index as
      // `DESC NULLS LAST`, and Postgres matches null-ordering when picking a
      // sortless plan — a bare `DESC` (implicit NULLS FIRST) forces a Sort
      // node even though both columns are NOT NULL.
      .orderBy(
        sql`${bookings.createdAt} desc nulls last`,
        sql`${bookings.id} desc nulls last`,
      )
      .limit(limit);

    return rows;
  }
}
