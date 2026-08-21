import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { ENV, type Env } from '../../config/env';
import {
  type EnqueueOptions,
  type JobHandler,
  type JobName,
  type JobPayloads,
  type QueuePort,
  type QueueStats,
} from './queue.port';

/**
 * BullMQ implementation of `QueuePort`.
 *
 * ONE QUEUE PER JOB NAME, not one shared queue. Head-of-line blocking is the
 * reason: Phase 13's notification fan-out is high-volume and slow, Phase 17's
 * dispatch timers are low-volume and latency-critical. Sharing a queue would
 * let a notification backlog delay an offer expiry, and it would make the
 * §12.3 depth alarm meaningless (one number over unrelated work). Separate
 * queues also give per-job concurrency, retry policy and DLQ for free.
 */

/** Attempts and backoff a job gets unless it asks for something else. */
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 5_000;

/**
 * Completed jobs are trimmed; FAILED JOBS ARE NOT. A failed job that has
 * exhausted its attempts is the dead-letter queue — deleting it would silently
 * throw away the only record that something needs a human (§12.3).
 */
const KEEP_COMPLETED = { age: 3_600, count: 1_000 };

/** BullMQ reserves `:` for its Redis keys and rejects a custom id containing one. */
function normalizeJobId(jobId: string): string {
  return jobId.replace(/:/g, '-');
}

@Injectable()
export class BullMqAdapter implements QueuePort, OnModuleDestroy {
  private readonly logger = new Logger(BullMqAdapter.name);
  private readonly queues = new Map<JobName, Queue>();
  private readonly deadLetterListeners: Array<(job: JobName, jobId: string, error: string) => void> = [];
  private readonly workers: Worker[] = [];
  private destroyed = false;

  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * Connection OPTIONS, not a client instance, for two reasons.
   *
   * 1. BullMQ 5 depends on `ioredis@5` while the app runs `ioredis@6`. Handing
   *    it one of our clients is a type error across the two majors (and would
   *    be a latent runtime hazard if the internals ever diverged). Options let
   *    BullMQ construct clients from its own ioredis.
   * 2. A worker blocks on BRPOPLPUSH for its whole life, so it needs a
   *    dedicated connection regardless — sharing the app's command client would
   *    stall every GET/SET behind the blocking read.
   *
   * `maxRetriesPerRequest: null` is required by BullMQ (its blocking commands
   * legitimately outlive a retry budget); our own command client stays
   * fail-fast at 3 for the §19.2 ladder.
   */
  private connection(): ConnectionOptions {
    const url = new URL(this.env.REDIS_URL);
    const db = url.pathname.replace('/', '');

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(db ? { db: Number(db) } : {}),
      // `rediss://` — ElastiCache in-transit encryption works with no code change.
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
      // Same capped backoff as RedisModule: a blip must not turn every task's
      // reconnect into a thundering herd when Redis comes back (§19.6).
      retryStrategy: (times: number) => Math.min(times * 200, 3_000),
    };
  }

  private queueFor(name: JobName): Queue {
    const existing = this.queues.get(name);
    if (existing) return existing;

    const queue = new Queue(name, {
      connection: this.connection(),
      defaultJobOptions: {
        attempts: DEFAULT_ATTEMPTS,
        backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_MS },
        removeOnComplete: KEEP_COMPLETED,
        removeOnFail: false,
      },
    });
    queue.on('error', (err) => this.logger.error(`queue ${name} error: ${err.message}`));
    this.queues.set(name, queue);
    return queue;
  }

  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayloads[N],
    options: EnqueueOptions = {},
  ): Promise<void> {
    if (!this.env.QUEUE_ENABLED) {
      this.logger.warn(`QUEUE_ENABLED=false — dropping ${name}`);
      return;
    }

    const jobOptions: JobsOptions = {
      // `:` is BullMQ's own Redis key separator and it rejects custom ids
      // containing one — at enqueue time, in production, on a path a caller
      // would reasonably write as `import:<uuid>`. Normalising here means no
      // caller has to know that.
      ...(options.jobId ? { jobId: normalizeJobId(options.jobId) } : {}),
      ...(options.delayMs ? { delay: options.delayMs } : {}),
      ...(options.attempts ? { attempts: options.attempts } : {}),
      ...(options.backoffMs
        ? { backoff: { type: 'exponential', delay: options.backoffMs } }
        : {}),
    };

    await this.queueFor(name).add(name, payload, jobOptions);
  }

  async schedule<N extends JobName>(
    name: N,
    payload: JobPayloads[N],
    cron: string,
  ): Promise<void> {
    if (!this.env.QUEUE_ENABLED) return;

    // Job schedulers are keyed in Redis, so every task calling this on boot
    // converges on ONE timer rather than N. Re-registering also updates the
    // pattern in place, so changing the cron does not leave an orphan.
    await this.queueFor(name).upsertJobScheduler(
      `${name}:cron`,
      { pattern: cron },
      { name, data: payload },
    );
    this.logger.log(`scheduled ${name} (${cron})`);
  }

  process<N extends JobName>(name: N, handler: JobHandler<N>): void {
    if (!this.env.QUEUE_ENABLED) {
      this.logger.warn(`QUEUE_ENABLED=false — no worker started for ${name}`);
      return;
    }

    const worker = new Worker(
      name,
      async (job) => {
        await handler(job.data as JobPayloads[N]);
      },
      {
        connection: this.connection(),
        concurrency: this.env.QUEUE_CONCURRENCY,
      },
    );

    worker.on('failed', (job, err) => {
      const attempts = job?.attemptsMade ?? 0;
      const max = job?.opts.attempts ?? DEFAULT_ATTEMPTS;
      // Distinguish "will retry" from "gave up": only the second is an
      // operational event worth waking someone for.
      const exhausted = attempts >= max;
      const level = exhausted ? 'error' : 'warn';
      if (exhausted) {
        // The DLQ landing, surfaced from the one place that already knows it.
        for (const listener of this.deadLetterListeners) {
          try {
            listener(name, job?.id ?? '?', err.message);
          } catch (listenerError) {
            this.logger.error(`dead-letter listener threw: ${String(listenerError)}`);
          }
        }
      }
      this.logger[level](
        `${name} job ${job?.id ?? '?'} failed (attempt ${attempts}/${max}): ${err.message}`,
      );
    });
    worker.on('error', (err) => this.logger.error(`worker ${name} error: ${err.message}`));

    this.workers.push(worker);
    this.logger.log(`worker started for ${name} (concurrency ${this.env.QUEUE_CONCURRENCY})`);
  }

  onDeadLetter(listener: (job: JobName, jobId: string, error: string) => void): void {
    this.deadLetterListeners.push(listener);
  }

  async stats(): Promise<QueueStats[]> {
    const names = [...this.queues.keys()];
    return Promise.all(
      names.map(async (name) => {
        const counts = await this.queueFor(name).getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'completed',
        );
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
        };
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    // Workers first so nothing picks up new work while the queues close.
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
  }
}
