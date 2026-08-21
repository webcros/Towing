import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env';
import { TEST_REDIS_URL } from '../../test/db';
import { MetricsService } from '../observability/metrics.service';
import { BullMqAdapter } from '../queue/bullmq.adapter';

/**
 * §12.3's "dead-letter queue for failures", plus the depth alarm that makes it
 * visible — proven rather than asserted.
 *
 * The adapter is constructed DIRECTLY rather than through Nest, matching
 * `queue.e2e.spec.ts`. Booting `AppModule` would start
 * `NotificationDispatcherService`'s own workers on these very job names, and
 * two workers competing for one job makes the outcome a coin flip: sometimes
 * the spec's poison handler wins, sometimes the real dispatcher does and
 * quietly no-ops on a delivery id that does not exist.
 */

const connection = (() => {
  const url = new URL(TEST_REDIS_URL);
  return { host: url.hostname, port: Number(url.port || 6379) };
})();

const PUSH_JOB = 'notifications.deliver.push';
const EMAIL_JOB = 'notifications.deliver.email';

function envWith(overrides: Record<string, string> = {}) {
  return loadEnv({
    ...process.env,
    QUEUE_ENABLED: 'true',
    METRICS_ENABLED: 'true',
    REDIS_URL: TEST_REDIS_URL,
    ...overrides,
  } as NodeJS.ProcessEnv);
}

const adapters: BullMqAdapter[] = [];
let metrics: MetricsService;

beforeAll(async () => {
  metrics = new MetricsService(envWith());
  await purge();
});

afterAll(async () => {
  for (const adapter of adapters) await adapter.onModuleDestroy();
  await purge();
});

async function purge(): Promise<void> {
  for (const name of [PUSH_JOB, EMAIL_JOB]) {
    const queue = new Queue(name, { connection });
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
  }
}

function newAdapter(): BullMqAdapter {
  const adapter = new BullMqAdapter(envWith());
  adapters.push(adapter);
  return adapter;
}

async function scrapeCounter(name: string): Promise<number> {
  const { body } = await metrics.scrape();
  return body
    .split('\n')
    .filter((line) => line.startsWith(name) && !line.startsWith('#'))
    .reduce((total, line) => total + Number(line.trim().split(/\s+/).at(-1) ?? 0), 0);
}

async function until(predicate: () => boolean | Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('condition not met before timeout');
}

describe('notification DLQ', () => {
  it('lands a poison message in the DLQ and fires the depth alarm exactly once', async () => {
    const adapter = newAdapter();
    const dead: string[] = [];

    adapter.onDeadLetter((job, jobId) => {
      if (job === PUSH_JOB) {
        dead.push(jobId);
        metrics.observeDeadLetter(job);
      }
    });

    let attempts = 0;
    // A handler that can never succeed — the definition of a poison message.
    // Nothing about it is recoverable, which is exactly why it must end up
    // somewhere a human looks instead of retrying forever.
    adapter.process(PUSH_JOB, async () => {
      attempts += 1;
      throw new Error('poison');
    });

    const before = await scrapeCounter('notification_dead_lettered_total');

    await adapter.enqueue(
      PUSH_JOB,
      { deliveryId: '00000000-0000-4000-8000-00000000dead' },
      { jobId: `dlq-poison-${Date.now()}`, attempts: 2, backoffMs: 10 },
    );

    await until(async () => {
      const stats = await adapter.stats();
      return (stats.find((s) => s.name === PUSH_JOB)?.failed ?? 0) > 0;
    });

    // Every attempt was spent, then the job STAYED — `removeOnFail: false` is
    // the DLQ, and a job that evaporated would leave nothing to triage.
    expect(attempts).toBe(2);
    const stats = await adapter.stats();
    expect(stats.find((s) => s.name === PUSH_JOB)!.failed).toBe(1);

    // ONE alarm increment for one dead message. The counter is driven from
    // BullMQ's `failed` handler, where `attemptsMade >= opts.attempts` is
    // already known — not from a domain table's `attempts` column, which
    // increments on every invocation and would double-count both the retry and
    // any later operator replay.
    await until(() => dead.length > 0);
    expect(dead).toHaveLength(1);
    expect(await scrapeCounter('notification_dead_lettered_total')).toBe(before + 1);
  }, 40_000);

  it('does not dead-letter a job that fails once and then succeeds', async () => {
    const adapter = newAdapter();
    const dead: string[] = [];
    let attempts = 0;

    adapter.onDeadLetter((job, jobId) => {
      if (job === EMAIL_JOB) dead.push(jobId);
    });

    adapter.process(EMAIL_JOB, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('transient provider blip');
    });

    await adapter.enqueue(
      EMAIL_JOB,
      { deliveryId: '00000000-0000-4000-8000-00000000beef' },
      { jobId: `dlq-retry-${Date.now()}`, attempts: 3, backoffMs: 10 },
    );

    await until(async () => {
      const stats = await adapter.stats();
      return (stats.find((s) => s.name === EMAIL_JOB)?.completed ?? 0) > 0;
    });

    expect(attempts).toBe(2);
    // A blip is not an incident. Counting it would make the §12.3 alarm fire
    // on ordinary provider flakiness and train everyone to ignore it.
    expect(dead).toEqual([]);
  }, 40_000);

  it('reports notification queues in the stats the health endpoint serves', async () => {
    const adapter = adapters[0]!;
    const stats = await adapter.stats();

    // `GET /v1/health/queues` sums `failed` across these into `deadLettered`.
    expect(stats.some((q) => q.name.startsWith('notifications.'))).toBe(true);
    expect(stats.reduce((sum, q) => sum + q.failed, 0)).toBeGreaterThan(0);
  });
});
