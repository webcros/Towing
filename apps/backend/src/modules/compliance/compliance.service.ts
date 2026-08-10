import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { FleetEventsService } from '../../common/events/fleet-events.service';
import {
  NOTIFICATIONS,
  type NotificationPort,
} from '../../common/notifications/notification.port';
import { QUEUE, type QueuePort } from '../../common/queue/queue.port';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db.module';
import { runComplianceSweep, type SweepResult } from './compliance-sweep';

/**
 * Owns the hourly compliance job (§9.3.4): registers the cron, runs the sweep,
 * then fans out notifications and busts the affected fleets' dashboards.
 */
@Injectable()
export class ComplianceService implements OnModuleInit {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(QUEUE) private readonly queue: QueuePort,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationPort,
    @Inject(ENV) private readonly env: Env,
    private readonly events: FleetEventsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Registering the worker and the schedule from every task is intentional:
    // the adapter deduplicates the schedule in Redis, so N tasks give one timer
    // and N consumers. That is the property that makes this safe to scale.
    this.queue.process('compliance.sweep', async (payload) => {
      await this.sweep(payload.reason);
    });

    await this.queue.schedule(
      'compliance.sweep',
      { reason: 'cron' },
      this.env.COMPLIANCE_SWEEP_CRON,
    );
  }

  /**
   * Runs the sweep and its side effects. Safe to call directly — it is
   * idempotent by construction, which is why the seed and the tests do.
   */
  async sweep(reason: 'cron' | 'manual', fleetId?: string): Promise<SweepResult> {
    const started = Date.now();
    const result = await runComplianceSweep(this.db, fleetId ? { fleetId } : {});

    // Notifications are best-effort and must never fail the sweep: a provider
    // outage would otherwise roll the whole hour's work back into a retry that
    // re-does the (already idempotent) database half for nothing.
    for (const target of result.notify) {
      try {
        await this.notifications.notify({
          to: target.fleetId,
          channel: 'email',
          template: 'fleet_compliance_expiring',
          variables: {
            plate: target.truckPlate,
            docType: target.docType,
            daysLeft: String(target.daysLeft),
            expiresAt: target.expiresAt.toISOString(),
          },
        });
      } catch (err) {
        this.logger.warn(
          `compliance notification failed for ${target.docId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Anything that moved changes `activeTrucks` (and so `utilizationPct`) or
    // the alert feed, so the affected fleets need a cache bust + a live push.
    const changed =
      result.trucksBlocked + result.trucksCleared + result.alertsOpened + result.alertsResolved;
    if (changed > 0) {
      for (const affected of await this.affectedFleets(fleetId)) {
        await this.events.emit(affected, { kind: 'truck_changed' });
      }
    }

    this.logger.log(
      `compliance sweep (${reason}) in ${Date.now() - started}ms — ` +
        `expired ${result.expired}, expiring ${result.expiringSoon}, ` +
        `blocked ${result.trucksBlocked}, cleared ${result.trucksCleared}, ` +
        `alerts +${result.alertsOpened}/-${result.alertsResolved}, notified ${result.notify.length}`,
    );

    return result;
  }

  /**
   * Which fleets to bust. Narrow when the sweep was fleet-scoped; otherwise
   * every fleet that currently owns an open alert — cheaper and more honest
   * than busting every tenant in the system on an hour where nothing changed
   * for most of them.
   */
  private async affectedFleets(fleetId?: string): Promise<string[]> {
    if (fleetId) return [fleetId];
    const rows = await this.db.execute<{ fleet_id: string }>(
      sql`select distinct fleet_id from alerts where resolved_at is null`,
    );
    return rows.map((r) => r.fleet_id);
  }
}
