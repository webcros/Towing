import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env';
import { TEST_REDIS_URL } from '../../test/db';
import { BullMqAdapter } from './bullmq.adapter';
import type { JobPayloads } from './queue.port';

/**
 * The real BullMQ round trip.
 *
 * `setup.ts` turns the queue OFF for every other spec so live workers cannot
 * race them; this file is where the Track-B-blocking bullet is actually
 * proven — durable enqueue, worker delivery, retry with backoff, and a failed
 * job that stays put as the dead-letter record.
 *
 * The adapter is constructed directly rather than through Nest: it needs only
 * env, and this keeps the spec off the AppModule's boot path.
 */

const connection = (() => {
  const url = new URL(TEST_REDIS_URL);
  return { host: url.hostname, port: Number(url.port || 6379) };
})();

function adapterWith(overrides: Record<string, string> = {}): BullMqAdapter {
  const env = loadEnv({
    ...process.env,
    QUEUE_ENABLED: 'true',
    REDIS_URL: TEST_REDIS_URL,
    ...overrides,
  } as NodeJS.ProcessEnv);
  return new BullMqAdapter(env);
}

/** Waits for a condition without a fixed sleep — queues are inherently async. */
async function until(predicate: () => boolean | Promise<boolean>, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('condition not met before timeout');
}

let created: BullMqAdapter[] = [];
const rawQueues: Queue[] = [];

function track(adapter: BullMqAdapter): BullMqAdapter {
  created.push(adapter);
  return adapter;
}

async function purge(): Promise<void> {
  for (const name of ['compliance.sweep', 'trucks.bulk-import']) {
    const q = new Queue(name, { connection });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
  }
}

describe('BullMqAdapter', () => {
  beforeAll(async () => {
    // Leftovers from a previous run would be delivered to this run's workers.
    await purge();
  });

  /**
   * Every adapter is closed before the next test starts. Workers left running
   * would compete for the shared queue and steal each other's jobs — the tests
   * would then fail on timeouts that say nothing about the adapter.
   */
  afterEach(async () => {
    await Promise.allSettled(created.map((a) => a.onModuleDestroy()));
    created = [];
    await purge();
  });

  afterAll(async () => {
    await Promise.allSettled(rawQueues.map((q) => q.close()));
  });

  it('delivers an enqueued job to a worker with its payload intact', async () => {
    const adapter = track(adapterWith());
    const seen: Array<JobPayloads['trucks.bulk-import']> = [];
    adapter.process('trucks.bulk-import', async (payload) => {
      seen.push(payload);
    });

    const importId = randomUUID();
    await adapter.enqueue('trucks.bulk-import', { fleetId: 'fleet-1', importId });

    await until(() => seen.length === 1);
    expect(seen[0]).toEqual({ fleetId: 'fleet-1', importId });
  });

  it('deduplicates by jobId so a retried request cannot run the work twice', async () => {
    const adapter = track(adapterWith());
    let runs = 0;
    adapter.process('trucks.bulk-import', async () => {
      runs += 1;
    });

    const importId = randomUUID();
    // Deliberately colon-separated: BullMQ rejects `:` in a custom id, and
    // `import:<uuid>` is exactly what a caller writes by reflex. The adapter
    // normalises it so that is not a production-only failure.
    const jobId = `import:${importId}`;
    await adapter.enqueue('trucks.bulk-import', { fleetId: 'f', importId }, { jobId });
    await adapter.enqueue('trucks.bulk-import', { fleetId: 'f', importId }, { jobId });
    await adapter.enqueue('trucks.bulk-import', { fleetId: 'f', importId }, { jobId });

    await until(() => runs >= 1);
    await new Promise((r) => setTimeout(r, 500));
    // This is what makes "enqueue on every request" safe (Phase 17 relies on it
    // for offer timers keyed by booking).
    expect(runs).toBe(1);
  });

  it('retries a failing job, then leaves it in the DLQ', async () => {
    const adapter = track(adapterWith());
    let attempts = 0;
    adapter.process('trucks.bulk-import', async () => {
      attempts += 1;
      throw new Error('boom');
    });

    await adapter.enqueue(
      'trucks.bulk-import',
      { fleetId: 'f', importId: randomUUID() },
      { attempts: 2, backoffMs: 10 },
    );

    await until(() => attempts >= 2, 15_000);
    // Exhausted attempts must remain visible: a deleted failed job is the only
    // record that something needs a human (§12.3).
    await until(async () => {
      const stats = await adapter.stats();
      return (stats.find((s) => s.name === 'trucks.bulk-import')?.failed ?? 0) >= 1;
    });

    const stats = await adapter.stats();
    expect(stats.find((s) => s.name === 'trucks.bulk-import')?.failed).toBeGreaterThanOrEqual(1);
  });

  it('honours a delay — the primitive Phase 17 offer timers need', async () => {
    const adapter = track(adapterWith());
    let ranAt = 0;
    adapter.process('trucks.bulk-import', async () => {
      ranAt = Date.now();
    });

    const enqueuedAt = Date.now();
    await adapter.enqueue(
      'trucks.bulk-import',
      { fleetId: 'f', importId: randomUUID() },
      { delayMs: 600 },
    );

    await until(() => ranAt > 0);
    // Durable and server-side: unlike setTimeout it survives the task dying.
    expect(ranAt - enqueuedAt).toBeGreaterThanOrEqual(550);
  });

  it('registers one schedule however many tasks call it', async () => {
    // Three "tasks" booting against one Redis, exactly what N Fargate tasks do.
    const adapters = [adapterWith(), adapterWith(), adapterWith()].map(track);
    for (const adapter of adapters) {
      await adapter.schedule('compliance.sweep', { reason: 'cron' }, '0 * * * *');
    }

    const queue = new Queue('compliance.sweep', { connection });
    rawQueues.push(queue);
    const schedulers = await queue.getJobSchedulers();

    // The property `@nestjs/schedule` cannot give us: N tasks, one timer. With
    // one per task the hourly sweep would run N times an hour.
    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]?.pattern).toBe('0 * * * *');
  });

  it('drops work silently when disabled, without starting a worker', async () => {
    const adapter = track(adapterWith({ QUEUE_ENABLED: 'false' }));
    let runs = 0;
    adapter.process('trucks.bulk-import', async () => {
      runs += 1;
    });
    await adapter.enqueue('trucks.bulk-import', { fleetId: 'f', importId: randomUUID() });

    await new Promise((r) => setTimeout(r, 400));
    expect(runs).toBe(0);
    // Nothing was registered, so nothing to report.
    expect(await adapter.stats()).toEqual([]);
  });
});
