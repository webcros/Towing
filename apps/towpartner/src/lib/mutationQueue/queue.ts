import { newIdempotencyKey } from '@/lib/api/idempotency';
import { storage } from '@/lib/storage/storage';

/**
 * Durable queue for mutations that failed on a genuine network error (not a
 * 4xx/5xx response) while the driver was mid-job with a weak signal —
 * `client.ts`'s `enqueueOnFailure` option is the only writer. MMKV-backed
 * (via the shared `storage` singleton) so a queued entry survives an app kill
 * between the failed attempt and the next reconnect.
 *
 * `id` identifies the queue slot itself; `idempotencyKey` is the value the
 * original request was sent with and MUST be replayed unchanged — see
 * `client.ts`'s `flushMutationQueue` for why minting a fresh one on replay
 * would defeat the whole point of idempotency.
 */
export interface QueuedMutation {
  id: string;
  method: string;
  /** Relative API path, exactly as passed to `apiFetch` (no `/v1/` prefix, no origin). */
  url: string;
  body: string | undefined;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
}

const QUEUE_KEY = 'mutationQueue.v1';

function readQueue(): QueuedMutation[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueMutation(entry: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts'>): void {
  const queue = readQueue();
  queue.push({ ...entry, id: newIdempotencyKey(), createdAt: new Date().toISOString(), attempts: 0 });
  writeQueue(queue);
}

export function readQueuedMutations(): QueuedMutation[] {
  return readQueue();
}

export function removeQueuedMutation(id: string): void {
  writeQueue(readQueue().filter((entry) => entry.id !== id));
}

export function bumpQueuedMutationAttempts(id: string): void {
  writeQueue(readQueue().map((entry) => (entry.id === id ? { ...entry, attempts: entry.attempts + 1 } : entry)));
}

/**
 * Called on logout — a queued entry has no session/token binding of its own
 * (it replays under whoever is logged in when connectivity returns), so on a
 * shared device a still-queued mutation from the outgoing driver's session
 * must not survive to be replayed under the next driver's.
 */
export function clearQueuedMutations(): void {
  writeQueue([]);
}
