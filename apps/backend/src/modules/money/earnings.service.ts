import { Inject, Injectable } from '@nestjs/common';
import {
  paiseToRupeeString,
  rupeeStringToPaise,
  type EarningsQuery,
  type EarningsSummaryDto,
  type FleetId,
  type JobSplitDto,
  type SplitsListResponse,
  type SplitsQuery,
} from '@towing/api-contracts';
import type { Response } from 'express';
import { streamCsv } from '../../common/csv/csv';
import { ENV, type Env } from '../../config/env';
import { decodeCursor, encodeCursor } from '../jobs/jobs.cursor';
import { EarningsRepo } from './earnings.repo';

const EXPORT_BATCH = 1_000;

/**
 * §9.3.7's monthly statement. Job code, date, driver and money — and
 * deliberately **no customer name, phone or address**: §9.3.8's AC is "exports
 * contain no customer PII beyond what invoices require", and a fleet's earnings
 * statement is not an invoice. `earnings.e2e.spec.ts` asserts the header.
 */
const STATEMENT_HEADER = [
  'job_code',
  'settled_at',
  'driver',
  'gross_rupees',
  'commission_band',
  'commission_pct',
  'commission_rupees',
  'pool_rupees',
  'driver_share_rupees',
  'fleet_share_rupees',
];

@Injectable()
export class EarningsService {
  constructor(
    private readonly repo: EarningsRepo,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async summary(fleetId: FleetId, query: EarningsQuery): Promise<EarningsSummaryDto> {
    const { from, to } = resolvePeriod(query);

    const [totals, trend, wallet, linked] = await Promise.all([
      this.repo.totals(fleetId, from, to),
      this.repo.trend(fleetId, from, to),
      this.repo.walletPosition(fleetId),
      this.repo.hasActivePayoutAccount(fleetId),
    ]);

    const balancePaise = rupeeStringToPaise(wallet.balance);
    const heldPaise = rupeeStringToPaise(wallet.heldInPayouts);

    return {
      period: { from, to },
      wallet: {
        balancePaise,
        // The balance already carries the debit for an open payout (a hold IS a
        // debit — see PayoutsService), so this subtraction is belt-and-braces
        // against a payout that somehow committed without its leg. It can never
        // overstate what is withdrawable, which is the direction that matters.
        availablePaise: Math.max(0, balancePaise - Math.max(0, heldPaise)),
        minPayoutPaise: this.env.PAYOUT_MIN_PAISE,
        maxPayoutPaise: this.env.PAYOUT_MAX_PAISE,
        payoutAccountLinked: linked,
      },
      totals: {
        jobs: totals.jobs,
        grossPaise: rupeeStringToPaise(totals.gross),
        commissionPaise: rupeeStringToPaise(totals.commission),
        poolPaise: rupeeStringToPaise(totals.pool),
        driverSharePaise: rupeeStringToPaise(totals.driverShare),
        fleetSharePaise: rupeeStringToPaise(totals.fleetShare),
      },
      trend: trend.map((point) => ({
        date: point.day,
        grossPaise: rupeeStringToPaise(point.gross),
        fleetSharePaise: rupeeStringToPaise(point.fleetShare),
      })),
    };
  }

  async splits(fleetId: FleetId, query: SplitsQuery): Promise<SplitsListResponse> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    // One extra row: its presence is the "there is a next page" signal.
    const rows = await this.repo.splitFeed(fleetId, query, cursor, query.limit + 1);

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.bookingId })
        : null;

    return { items: page.map(toSplitDto), nextCursor };
  }

  /** §9.3.7's "monthly statement export (CSV/PDF)" — the CSV half. */
  async statementCsv(fleetId: FleetId, month: string, res: Response): Promise<void> {
    const { from, to } = monthBounds(month);
    let cursor: { createdAt: Date; id: string } | undefined;
    let done = false;

    await streamCsv(
      res,
      { filename: `towfleet-statement-${month}.csv`, header: STATEMENT_HEADER },
      async () => {
        if (done) return [];

        const rows = await this.repo.splitFeed(fleetId, { from, to }, cursor, EXPORT_BATCH);
        if (rows.length < EXPORT_BATCH) {
          done = true;
        } else {
          const last = rows[rows.length - 1]!;
          cursor = { createdAt: last.createdAt, id: last.bookingId };
        }

        return rows.map((row) => {
          const dto = toSplitDto(row);
          return [
            dto.jobCode,
            dto.settledAt,
            dto.driverName ?? '',
            paiseToRupeeString(dto.grossPaise),
            dto.commissionBand ?? '',
            dto.commissionPct === null ? '' : String(dto.commissionPct),
            paiseToRupeeString(dto.commissionPaise),
            paiseToRupeeString(dto.poolPaise),
            paiseToRupeeString(dto.driverSharePaise),
            paiseToRupeeString(dto.fleetSharePaise),
          ];
        });
      },
    );
  }
}

type SplitRow = Awaited<ReturnType<EarningsRepo['splitFeed']>>[number];

function toSplitDto(row: SplitRow): JobSplitDto {
  const grossPaise = rupeeStringToPaise(row.total);
  const commissionPaise = rupeeStringToPaise(row.commissionAmount);

  return {
    bookingId: row.bookingId,
    // Display-only, derived from the id — bookings have no code column. Same
    // derivation as the jobs feed so one job reads identically on both screens.
    jobCode: `TW-${row.bookingId.slice(0, 8).toUpperCase()}`,
    settledAt: row.settledAt.toISOString(),
    driverId: row.driverId,
    driverName: row.driverName,
    grossPaise,
    commissionBand: row.commissionBand,
    commissionPct: row.commissionPct === null ? null : Number(row.commissionPct),
    commissionPaise,
    poolPaise: grossPaise - commissionPaise,
    driverSharePaise: rupeeStringToPaise(row.driverShare),
    fleetSharePaise: rupeeStringToPaise(row.fleetShare),
  };
}

const IST_OFFSET_MS = 5.5 * 3_600_000;

/** IST calendar date of an instant, as `YYYY-MM-DD`. */
function istDate(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Both bounds omitted ⇒ the current IST calendar month. */
function resolvePeriod(query: { from?: string; to?: string }): { from: string; to: string } {
  const today = istDate(new Date());
  if (query.from && query.to) return { from: query.from, to: query.to };
  if (query.from) return { from: query.from, to: today };
  if (query.to) return { from: `${query.to.slice(0, 7)}-01`, to: query.to };
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  // Day 0 of the next month is the last day of this one, and it handles
  // February and leap years without a table.
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}
