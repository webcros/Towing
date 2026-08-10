import { Injectable } from '@nestjs/common';
import {
  paiseToRupeeString,
  rupeeStringToPaise,
  type FleetId,
  type ReportQuery,
  type ReportResponse,
} from '@towing/api-contracts';
import type { Response } from 'express';
import { streamCsv } from '../../common/csv/csv';
import { ApiException } from '../../common/errors/api-exception';
import { ReportsRepo } from './reports.repo';

/** Per-grain CSV headers. Money is rupees, matching every other export. */
const HEADERS: Record<ReportQuery['groupBy'], string[]> = {
  truck: [
    'plate',
    'type',
    'status',
    'jobs',
    'in_service_days',
    'active_days',
    'utilization_pct',
    'gross_rupees',
    'fleet_share_rupees',
    'compliance_expiring',
    'compliance_expired',
  ],
  driver: [
    'driver',
    'kyc_status',
    'jobs',
    'gross_rupees',
    'driver_share_rupees',
    'fleet_share_rupees',
    'rating',
  ],
  period: [
    'bucket',
    'jobs',
    'gross_rupees',
    'commission_rupees',
    'pool_rupees',
    'driver_share_rupees',
    'fleet_share_rupees',
  ],
};

/** A year of daily buckets is already a lot to render; beyond that, aggregate. */
const MAX_WINDOW_DAYS = 400;

@Injectable()
export class ReportsService {
  constructor(private readonly repo: ReportsRepo) {}

  async generate(fleetId: FleetId, query: ReportQuery): Promise<ReportResponse> {
    const period = this.validatePeriod(query);

    if (query.groupBy === 'truck') {
      const rows = await this.repo.byTruck(fleetId, period.from, period.to);
      return {
        groupBy: 'truck',
        period,
        rows: rows.map((row) => ({
          truckId: row.truckId,
          plate: row.plate,
          type: row.type,
          status: row.status,
          jobs: row.jobs,
          inServiceDays: row.inServiceDays,
          activeDays: row.activeDays,
          utilizationPct: pct(row.activeDays, row.inServiceDays),
          grossPaise: rupeeStringToPaise(row.gross),
          fleetSharePaise: rupeeStringToPaise(row.fleetShare),
          complianceExpiringCount: row.complianceExpiring,
          complianceExpiredCount: row.complianceExpired,
        })),
      };
    }

    if (query.groupBy === 'driver') {
      const rows = await this.repo.byDriver(fleetId, period.from, period.to);
      return {
        groupBy: 'driver',
        period,
        rows: rows.map((row) => ({
          driverId: row.driverId,
          name: row.name,
          kycStatus: row.kycStatus,
          jobs: row.jobs,
          grossPaise: rupeeStringToPaise(row.gross),
          driverSharePaise: rupeeStringToPaise(row.driverShare),
          fleetSharePaise: rupeeStringToPaise(row.fleetShare),
          ratingAvg: row.rating === null ? null : Number(row.rating),
        })),
      };
    }

    const rows = await this.repo.byPeriod(fleetId, period.from, period.to, query.granularity);
    return {
      groupBy: 'period',
      period,
      granularity: query.granularity,
      rows: rows.map((row) => ({
        bucket: row.bucket,
        jobs: row.jobs,
        grossPaise: rupeeStringToPaise(row.gross),
        commissionPaise: rupeeStringToPaise(row.commission),
        poolPaise: rupeeStringToPaise(row.pool),
        driverSharePaise: rupeeStringToPaise(row.driverShare),
        fleetSharePaise: rupeeStringToPaise(row.fleetShare),
      })),
    };
  }

  /**
   * Report rows are bounded (trucks, drivers, buckets), but this uses the
   * streaming helper anyway so a three-year daily report never buffers — and so
   * there is one CSV code path, not a streaming one and a convenient one.
   */
  async exportCsv(fleetId: FleetId, query: ReportQuery, res: Response): Promise<void> {
    const report = await this.generate(fleetId, query);
    let sent = false;

    await streamCsv(
      res,
      {
        filename: `towfleet-report-${query.groupBy}-${report.period.from}-to-${report.period.to}.csv`,
        header: HEADERS[query.groupBy],
      },
      async () => {
        if (sent) return [];
        sent = true;

        if (report.groupBy === 'truck') {
          return report.rows.map((row) => [
            row.plate,
            row.type,
            row.status,
            String(row.jobs),
            String(row.inServiceDays),
            String(row.activeDays),
            row.utilizationPct.toFixed(1),
            paiseToRupeeString(row.grossPaise),
            paiseToRupeeString(row.fleetSharePaise),
            String(row.complianceExpiringCount),
            String(row.complianceExpiredCount),
          ]);
        }

        if (report.groupBy === 'driver') {
          return report.rows.map((row) => [
            row.name,
            row.kycStatus,
            String(row.jobs),
            paiseToRupeeString(row.grossPaise),
            paiseToRupeeString(row.driverSharePaise),
            paiseToRupeeString(row.fleetSharePaise),
            row.ratingAvg === null ? '' : row.ratingAvg.toFixed(1),
          ]);
        }

        return report.rows.map((row) => [
          row.bucket,
          String(row.jobs),
          paiseToRupeeString(row.grossPaise),
          paiseToRupeeString(row.commissionPaise),
          paiseToRupeeString(row.poolPaise),
          paiseToRupeeString(row.driverSharePaise),
          paiseToRupeeString(row.fleetSharePaise),
        ]);
      },
    );
  }

  private validatePeriod(query: ReportQuery): { from: string; to: string } {
    if (query.from > query.to) {
      throw ApiException.validation('Report `from` must not be after `to`');
    }

    const days = (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000 + 1;
    if (days > MAX_WINDOW_DAYS) {
      throw ApiException.validation(
        `Report window is limited to ${MAX_WINDOW_DAYS} days; narrow the range or use a coarser granularity`,
      );
    }

    return { from: query.from, to: query.to };
  }
}

/** One decimal place; a truck with no in-service days is 0%, not NaN. */
function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
