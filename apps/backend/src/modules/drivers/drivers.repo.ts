import { Inject, Injectable } from '@nestjs/common';
import type { FleetId } from '@towing/api-contracts';
import { and, asc, count, eq, gte, inArray, sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { drivers, fleetTrucks, wallets, walletTransactions } from '../../db/schema';

export type DriverRow = typeof drivers.$inferSelect;

@Injectable()
export class DriversRepo {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listPage(
    fleetId: FleetId,
    params: { page: number; limit: number },
  ): Promise<{ rows: DriverRow[]; total: number }> {
    const where = eq(drivers.fleetId, fleetId);
    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(drivers)
        .where(where)
        .orderBy(asc(drivers.name))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit),
      this.db.select({ total: count() }).from(drivers).where(where),
    ]);
    return { rows, total: totalRow?.total ?? 0 };
  }

  /** Batched: plates for the page's assigned trucks in one query. */
  async platesFor(truckIds: string[]): Promise<Map<string, string>> {
    if (truckIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: fleetTrucks.id, plate: fleetTrucks.plate })
      .from(fleetTrucks)
      .where(inArray(fleetTrucks.id, truckIds));
    return new Map(rows.map((r) => [r.id, r.plate]));
  }

  /**
   * Batched: month-to-date net per driver — SUM(driver_share_credit) since the
   * IST month start, grouped by wallet owner. Returns rupee-string sums.
   */
  async monthNetFor(driverIds: string[], monthStart: Date): Promise<Map<string, string>> {
    if (driverIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        driverId: wallets.ownerId,
        total: sql<string>`coalesce(sum(${walletTransactions.amount}), 0)`,
      })
      .from(walletTransactions)
      .innerJoin(wallets, eq(wallets.id, walletTransactions.walletId))
      .where(
        and(
          eq(wallets.ownerType, 'driver'),
          inArray(wallets.ownerId, driverIds),
          eq(walletTransactions.type, 'driver_share_credit'),
          gte(walletTransactions.createdAt, monthStart),
        ),
      )
      .groupBy(wallets.ownerId);
    return new Map(rows.map((r) => [r.driverId, r.total]));
  }

  async findById(fleetId: FleetId, driverId: string): Promise<DriverRow | undefined> {
    const [row] = await this.db
      .select()
      .from(drivers)
      .where(and(eq(drivers.fleetId, fleetId), eq(drivers.id, driverId)))
      .limit(1);
    return row;
  }

  async invite(
    fleetId: FleetId,
    data: { name: string; mobile: string; vehicleClass?: DriverRow['vehicleClass'] },
  ): Promise<DriverRow> {
    const [row] = await this.db
      .insert(drivers)
      .values({
        fleetId,
        name: data.name,
        mobile: data.mobile,
        vehicleClass: data.vehicleClass ?? null,
        kycStatus: 'incomplete',
      })
      .returning();
    return row!;
  }

  /** Truck lookup scoped to the fleet — cross-tenant truck ids read as absent. */
  async truckInFleet(fleetId: FleetId, truckId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: fleetTrucks.id })
      .from(fleetTrucks)
      .where(and(eq(fleetTrucks.fleetId, fleetId), eq(fleetTrucks.id, truckId)))
      .limit(1);
    return row !== undefined;
  }

  async setAssignedTruck(
    fleetId: FleetId,
    driverId: string,
    truckId: string | null,
  ): Promise<DriverRow | undefined> {
    const [row] = await this.db
      .update(drivers)
      .set({ assignedTruckId: truckId, updatedAt: new Date() })
      .where(and(eq(drivers.fleetId, fleetId), eq(drivers.id, driverId)))
      .returning();
    return row;
  }
}
