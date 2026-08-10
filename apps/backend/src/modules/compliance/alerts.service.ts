import { Inject, Injectable } from '@nestjs/common';
import type {
  AlertsListResponse,
  AlertsQuery,
  FleetAlertDto,
  FleetId,
  StoredAlertDto,
} from '@towing/api-contracts';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { alerts } from '../../db/schema';

type AlertRow = typeof alerts.$inferSelect;

/** Errors first, then newest — an expired doc outranks a countdown. */
const SEVERITY_RANK: Record<AlertRow['severity'], number> = { error: 0, warning: 1, info: 2 };

function toDto(row: AlertRow): StoredAlertDto {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    href: row.href,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

/** Cursor is an opaque base64 of `(created_at, id)` — same idiom as the jobs feed. */
function encodeCursor(row: AlertRow): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!at || !id) return null;
    const createdAt = new Date(at);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
  } catch {
    return null;
  }
}

@Injectable()
export class AlertsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(fleetId: FleetId, query: AlertsQuery): Promise<AlertsListResponse> {
    const conditions = [eq(alerts.fleetId, fleetId)];
    if (!query.includeResolved) conditions.push(isNull(alerts.resolvedAt));
    if (query.severity) conditions.push(eq(alerts.severity, query.severity));

    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (cursor) {
      // Keyset, not offset: the feed grows at the head and offset pagination
      // would repeat rows as new alerts land mid-scroll.
      conditions.push(
        sql`(${alerts.createdAt}, ${alerts.id}) < (${cursor.createdAt.toISOString()}, ${cursor.id})`,
      );
    }

    const rows = await this.db
      .select()
      .from(alerts)
      .where(and(...conditions))
      // `desc nulls last` explicitly: drizzle-kit emits the index as DESC NULLS
      // LAST while a bare ORDER BY ... DESC implies NULLS FIRST, and Postgres
      // then adds a Sort node on every page (the Phase 4 jobs-feed lesson).
      .orderBy(sql`${alerts.createdAt} desc nulls last`, sql`${alerts.id} desc nulls last`)
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];

    return {
      items: page.map(toDto),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  /**
   * The dashboard feed: open alerts only, severity-ranked, capped. Shares the
   * stored rows with `list()` — Phase 6's whole point is that there is no
   * second, derived definition of what an alert is.
   */
  async dashboardFeed(fleetId: FleetId, limit = 10): Promise<FleetAlertDto[]> {
    const rows = await this.db
      .select()
      .from(alerts)
      .where(and(eq(alerts.fleetId, fleetId), isNull(alerts.resolvedAt)))
      .orderBy(sql`${alerts.createdAt} desc nulls last`)
      .limit(50);

    return rows
      .sort(
        (a, b) =>
          SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice(0, limit)
      .map((row) => {
        const { resolvedAt: _resolvedAt, ...dto } = toDto(row);
        return dto;
      });
  }
}
