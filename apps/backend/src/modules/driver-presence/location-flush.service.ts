import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { DriverPresenceRepo, type FlushSample } from './driver-presence.repo';

/**
 * The slow, authoritative half of the pipeline (§6.1, §11.2: "only samples and
 * final positions are persisted").
 *
 * Redis takes every ping; Postgres takes one row per driver per flush window.
 * At the on-job cadence of 3s that is a 10× reduction, and the writes are
 * batched into two statements regardless of how many drivers are in the buffer —
 * so the database cost of the whole fleet scales with the FLUSH INTERVAL, not
 * with the ping rate. That is the property that lets the cadence be tuned down
 * to 1s from `config:update` without a schema discussion.
 *
 * PER-PROCESS, AND CORRECTLY SO. Each task buffers only the pings it handled;
 * there is no cross-node coordination, because the last-known position is
 * idempotent — whichever task writes last writes the newest fix it saw, and the
 * §19.2 degraded read only needs "recent", not "the very latest".
 *
 * `.unref()`, like `RealtimeRelayService`'s flush timer: a stray interval must
 * never be the reason a vitest worker or a draining ECS task refuses to exit.
 */
@Injectable()
export class LocationFlushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocationFlushService.name);
  /** driverId → newest fix seen this window. One row per driver, never a queue. */
  private pending = new Map<string, FlushSample>();
  private timer?: NodeJS.Timeout;
  private destroyed = false;
  private flushing = false;

  constructor(
    private readonly repo: DriverPresenceRepo,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), this.env.LOCATION_FLUSH_MS);
    this.timer.unref();
  }

  /**
   * Coalescing, not queueing: a driver already in the buffer is overwritten
   * rather than appended. `booking_location_path` is a breadcrumb trail, not a
   * full trace — §11.2 asks for samples, and storing every 3s fix would make
   * the table grow at ~1,200 rows per driver-hour for a replay nobody watches
   * at that resolution.
   */
  buffer(sample: FlushSample): void {
    if (this.destroyed) return;
    this.pending.set(sample.driverId, sample);
  }

  /**
   * Writes one driver's buffered fix immediately, if there is one.
   *
   * Go-offline calls this: §11.2 asks for "samples AND FINAL POSITIONS", and up
   * to 30s of a shift's last movement lives only in this map. Without it the
   * authoritative row — which the §19.2 degraded read and the console's REST
   * snapshot both serve — records where the driver was half a minute before
   * they finished, and that is the position an ops question about the end of a
   * shift would be answered from.
   */
  async flushDriver(driverId: string): Promise<void> {
    const sample = this.pending.get(driverId);
    if (!sample) return;
    this.pending.delete(driverId);
    await this.write([sample]);
  }

  private async flush(): Promise<void> {
    if (this.destroyed || this.flushing) return;
    if (this.pending.size === 0) return;

    this.flushing = true;
    const batch = [...this.pending.values()];
    this.pending = new Map();

    try {
      await this.write(batch);
    } catch (err) {
      // Never rethrow from a timer: an unhandled rejection here takes the
      // process down, and in vitest it fails an unrelated suite. The samples are
      // dropped rather than retried — the next flush is 30s away and carries a
      // NEWER position, so retrying a stale one would be strictly worse.
      this.logger.error(
        `location flush failed (${batch.length} drivers): ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.flushing = false;
    }
  }

  private async write(batch: FlushSample[]): Promise<void> {
    if (batch.length === 0) return;
    // Sequential, not parallel: both statements touch rows keyed by the same
    // driver ids, and issuing them concurrently on one pool connection buys
    // nothing while making a deadlock possible under load.
    await this.repo.flushPositions(batch);
    await this.repo.sampleBookingPath(batch);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;

    // The last window of movement exists only in memory until this runs — the
    // same final flush `simulate-locations.ts` performs on SIGINT.
    const batch = [...this.pending.values()];
    this.pending = new Map();
    this.destroyed = true;

    if (batch.length === 0) return;
    await this.write(batch).catch((err: unknown) => {
      this.logger.warn(
        `final location flush failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
}
