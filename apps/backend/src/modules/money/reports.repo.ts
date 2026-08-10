import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import type { FleetId, ReportGranularity } from '@towing/api-contracts';
import { DB_READER, type DatabaseReader } from '../../db/db.module';

/**
 * §9.3.8 reports: per truck / driver / period; utilization, revenue, compliance
 * history.
 *
 * `DB_READER` throughout — the AC is explicit that report queries must not
 * touch the live-ops path. The driver and period grains are pure
 * `earnings_daily` GROUP BYs, i.e. projection scans that never look at
 * `bookings` at all.
 */
@Injectable()
export class ReportsRepo {
  constructor(@Inject(DB_READER) private readonly db: DatabaseReader) {}

  async byDriver(
    fleetId: FleetId,
    from: string,
    to: string,
  ): Promise<
    Array<{
      driverId: string;
      name: string;
      kycStatus: string;
      jobs: number;
      gross: string;
      driverShare: string;
      fleetShare: string;
      rating: string | null;
    }>
  > {
    const rows = (await this.db.execute(sql`
      select e.driver_id,
             coalesce(d.name, 'Unknown') as name,
             coalesce(d.kyc_status::text, 'unknown') as kyc_status,
             sum(e.jobs)::int as jobs,
             sum(e.gross)::text as gross,
             sum(e.driver_share)::text as driver_share,
             sum(e.fleet_share)::text as fleet_share,
             d.rating::text as rating
        from earnings_daily e
        left join drivers d on d.id = e.driver_id
       where e.fleet_id = ${fleetId}::uuid
         and e.day between ${from}::date and ${to}::date
       group by e.driver_id, d.name, d.kyc_status, d.rating
       order by sum(e.gross) desc
    `)) as unknown as Array<{
      driver_id: string;
      name: string;
      kyc_status: string;
      jobs: number;
      gross: string;
      driver_share: string;
      fleet_share: string;
      rating: string | null;
    }>;

    return rows.map((row) => ({
      driverId: row.driver_id,
      name: row.name,
      kycStatus: row.kyc_status,
      jobs: row.jobs,
      gross: row.gross,
      driverShare: row.driver_share,
      fleetShare: row.fleet_share,
      rating: row.rating,
    }));
  }

  async byPeriod(
    fleetId: FleetId,
    from: string,
    to: string,
    granularity: ReportGranularity,
  ): Promise<
    Array<{
      bucket: string;
      jobs: number;
      gross: string;
      commission: string;
      pool: string;
      driverShare: string;
      fleetShare: string;
    }>
  > {
    // `date_trunc` on the IST day the projection already stores — no timezone
    // maths here, because the grain was decided when the cell was written.
    const truncated: SQL =
      granularity === 'day'
        ? sql`day`
        : granularity === 'week'
          ? sql`date_trunc('week', day)::date`
          : sql`date_trunc('month', day)::date`;

    const rows = (await this.db.execute(sql`
      select to_char(${truncated}, 'YYYY-MM-DD') as bucket,
             sum(jobs)::int as jobs,
             sum(gross)::text as gross,
             sum(commission)::text as commission,
             sum(pool)::text as pool,
             sum(driver_share)::text as driver_share,
             sum(fleet_share)::text as fleet_share
        from earnings_daily
       where fleet_id = ${fleetId}::uuid
         and day between ${from}::date and ${to}::date
       group by ${truncated}
       order by ${truncated}
    `)) as unknown as Array<{
      bucket: string;
      jobs: number;
      gross: string;
      commission: string;
      pool: string;
      driver_share: string;
      fleet_share: string;
    }>;

    return rows.map((row) => ({
      bucket: row.bucket,
      jobs: row.jobs,
      gross: row.gross,
      commission: row.commission,
      pool: row.pool,
      driverShare: row.driver_share,
      fleetShare: row.fleet_share,
    }));
  }

  /**
   * The truck grain, plus its compliance history.
   *
   * Truck attribution goes through `drivers.assigned_truck_id`. That is the
   * SAME honest proxy `DashboardService` already documents — bookings do not
   * carry a truck id yet, so this reports on the truck a driver is assigned to
   * *now*. Deliberately worded to match, so the two cannot drift into two
   * different stories about the same number.
   *
   * `utilizationPct` here is a PERIOD metric (share of in-service days with at
   * least one job), NOT the dashboard's instantaneous one. Same word, different
   * scope — the contract field says so too.
   */
  async byTruck(
    fleetId: FleetId,
    from: string,
    to: string,
  ): Promise<
    Array<{
      truckId: string;
      plate: string;
      type: string;
      status: string;
      jobs: number;
      inServiceDays: number;
      activeDays: number;
      gross: string;
      fleetShare: string;
      complianceExpiring: number;
      complianceExpired: number;
    }>
  > {
    const rows = (await this.db.execute(sql`
      with window_days as (
        select (${to}::date - ${from}::date) + 1 as total
      ),
      truck_earnings as (
        select d.assigned_truck_id as truck_id,
               sum(e.jobs)::int as jobs,
               count(distinct e.day)::int as active_days,
               sum(e.gross) as gross,
               sum(e.fleet_share) as fleet_share
          from earnings_daily e
          join drivers d on d.id = e.driver_id
         where e.fleet_id = ${fleetId}::uuid
           and e.day between ${from}::date and ${to}::date
           and d.assigned_truck_id is not null
         group by d.assigned_truck_id
      ),
      truck_compliance as (
        select c.truck_id,
               count(*) filter (where c.status = 'expiring_soon')::int as expiring,
               count(*) filter (where c.status = 'expired')::int as expired
          from compliance_documents c
          join fleet_trucks ft on ft.id = c.truck_id
         where ft.fleet_id = ${fleetId}::uuid
         group by c.truck_id
      )
      select t.id as truck_id,
             t.plate,
             t.type::text as type,
             t.status::text as status,
             coalesce(te.jobs, 0) as jobs,
             -- "In service" = not manually parked. A truck that spent the window
             -- inactive should not be scored as 0% utilised.
             case when t.status = 'inactive' then 0 else (select total from window_days) end
               ::int as in_service_days,
             coalesce(te.active_days, 0) as active_days,
             coalesce(te.gross, 0)::text as gross,
             coalesce(te.fleet_share, 0)::text as fleet_share,
             coalesce(tc.expiring, 0) as compliance_expiring,
             coalesce(tc.expired, 0) as compliance_expired
        from fleet_trucks t
        left join truck_earnings te on te.truck_id = t.id
        left join truck_compliance tc on tc.truck_id = t.id
       where t.fleet_id = ${fleetId}::uuid
       order by coalesce(te.gross, 0) desc, t.plate
    `)) as unknown as Array<{
      truck_id: string;
      plate: string;
      type: string;
      status: string;
      jobs: number;
      in_service_days: number;
      active_days: number;
      gross: string;
      fleet_share: string;
      compliance_expiring: number;
      compliance_expired: number;
    }>;

    return rows.map((row) => ({
      truckId: row.truck_id,
      plate: row.plate,
      type: row.type,
      status: row.status,
      jobs: row.jobs,
      inServiceDays: row.in_service_days,
      activeDays: row.active_days,
      gross: row.gross,
      fleetShare: row.fleet_share,
      complianceExpiring: row.compliance_expiring,
      complianceExpired: row.compliance_expired,
    }));
  }
}
