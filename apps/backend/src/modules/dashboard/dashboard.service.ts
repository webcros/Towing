import { Inject, Injectable } from '@nestjs/common';
import { rupeeStringToPaise, type DashboardSummaryDto, type FleetId } from '@towing/api-contracts';
import { and, count, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { CacheService } from '../../common/cache/cache.service';
import { istDayStart } from '../../common/time/ist';
import { DB, type Database } from '../../db/db.module';
import { bookings, drivers, fleetTrucks, wallets, walletTransactions } from '../../db/schema';
import { AlertsService } from '../compliance/alerts.service';

const ACTIVE_JOB_STATUSES = ['assigned', 'en_route', 'arrived', 'in_progress'] as const;
const CACHE_TTL_SECONDS = 15;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly cache: CacheService,
    private readonly alerts: AlertsService,
  ) {}

  getSummary(fleetId: FleetId): Promise<DashboardSummaryDto> {
    return this.cache.getOrSet(`dash:${fleetId}`, CACHE_TTL_SECONDS, () => this.compute(fleetId));
  }

  private async compute(fleetId: FleetId): Promise<DashboardSummaryDto> {
    const dayStart = istDayStart();

    const [truckCounts, [jobsToday], [revenueToday], [busy], alerts] = await Promise.all([
        this.db
          .select({ status: fleetTrucks.status, n: count() })
          .from(fleetTrucks)
          .where(eq(fleetTrucks.fleetId, fleetId))
          .groupBy(fleetTrucks.status),

        this.db
          .select({ n: count() })
          .from(bookings)
          .where(and(eq(bookings.fleetId, fleetId), gte(bookings.createdAt, dayStart))),

        this.db
          .select({ total: sql<string>`coalesce(sum(${walletTransactions.amount}), 0)` })
          .from(walletTransactions)
          .innerJoin(wallets, eq(wallets.id, walletTransactions.walletId))
          .where(
            and(
              eq(wallets.ownerType, 'fleet'),
              eq(wallets.ownerId, fleetId),
              eq(walletTransactions.type, 'fleet_share_credit'),
              gte(walletTransactions.createdAt, dayStart),
            ),
          ),

        // Utilization numerator: distinct assigned trucks of drivers currently
        // on an active booking. Honest proxy until bookings carry a truck_id.
        this.db
          .select({ n: sql<number>`count(distinct ${drivers.assignedTruckId})::int` })
          .from(bookings)
          .innerJoin(drivers, eq(drivers.id, bookings.driverId))
          .where(
            and(
              eq(bookings.fleetId, fleetId),
              inArray(bookings.status, [...ACTIVE_JOB_STATUSES]),
              isNotNull(drivers.assignedTruckId),
            ),
          ),

        // Phase 6: STORED alerts, not derived-on-read. The compliance worker
        // writes them; a failed payout writes one at the point of failure
        // (Phase 7). A derived alert has no honest createdAt, cannot be
        // resolved, and cannot drive a notification exactly once.
        this.alerts.dashboardFeed(fleetId),
      ]);

    const totalTrucks = truckCounts.reduce((sum, r) => sum + r.n, 0);
    const activeTrucks = truckCounts.find((r) => r.status === 'active')?.n ?? 0;
    const busyTrucks = busy?.n ?? 0;
    const utilizationPct =
      activeTrucks === 0 ? 0 : Math.min(100, Math.round((100 * busyTrucks) / activeTrucks));

    return {
      kpis: {
        activeTrucks,
        totalTrucks,
        jobsToday: jobsToday?.n ?? 0,
        revenueTodayPaise: Math.max(0, rupeeStringToPaise(revenueToday?.total ?? '0')),
        utilizationPct,
      },
      alerts,
    };
  }
}

