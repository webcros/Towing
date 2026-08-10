import { Redis } from 'ioredis';
import { TEST_REDIS_URL } from './db';

/**
 * Redis for tests that need to inspect or seed keys directly (presence hashes,
 * GEO sets, handshake tickets).
 *
 * Nothing flushed Redis between tests before Phase 5 — every existing key was
 * UUID-scoped so nothing collided. Realtime keys are not: `trucks:online:{id}`
 * and `truck:{id}` outlive their test and would leak into the next one.
 */

let client: Redis | undefined;

export function testRedis(): Redis {
  if (client) return client;
  client = new Redis(TEST_REDIS_URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
  });
  return client;
}

/**
 * Empties the test Redis. Guarded on the URL for the same reason `truncateAll()`
 * is: a developer with REDIS_URL exported in their shell must never have FLUSHDB
 * run against a real instance.
 */
export async function flushTestRedis(): Promise<void> {
  if (TEST_REDIS_URL !== 'redis://localhost:6380' && !process.env.TEST_REDIS_URL) {
    throw new Error('Refusing to FLUSHDB: TEST_REDIS_URL is not the throwaway stack');
  }
  await testRedis().flushdb();
}

export async function closeTestRedis(): Promise<void> {
  if (!client) return;
  await client.quit().catch(() => undefined);
  client = undefined;
}
