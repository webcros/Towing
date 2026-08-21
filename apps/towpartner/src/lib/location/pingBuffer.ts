import type { DriverLocationPing } from '@towing/api-contracts';
import { storage } from '@/lib/storage/storage';

/**
 * The on-device location buffer (§11.8's "a local ping buffer that flushes IN
 * ORDER on reconnect").
 *
 * WHY IT HAS TO BE DURABLE. A driver towing a car through a tunnel, a basement
 * car park or a dead-signal stretch of highway is exactly when the customer is
 * watching the map hardest, and it is also when Android is most likely to kill
 * a backgrounded process. An in-memory buffer loses that whole stretch of the
 * trip; MMKV survives the kill, so the breadcrumb trail resumes rather than
 * restarting.
 *
 * WHY IT IS SEPARATE FROM `lib/mutationQueue`. That queue replays MUTATIONS —
 * one request per entry, each carrying the idempotency key it was first sent
 * with, retried until the server acknowledges it. Location is the opposite
 * shape: entries are only meaningful as an ordered run, they are sent as one
 * batch rather than one request each, they are worthless once superseded, and
 * `seq` already makes a replay a no-op so no idempotency key is needed. Reusing
 * the mutation queue would mean N races over a recovering connection, arriving
 * shuffled — at which point the server's `seq` guard correctly discards most of
 * the backlog and the trail has holes in it.
 *
 * ⚠ NEVER RUN ON A DEVICE. No dev client has been built for this app, so this
 * has never buffered a real fix through a real tunnel.
 */

const BUFFER_KEY = 'location.buffer.v1';
const SEQ_KEY = 'location.seq.v1';

/**
 * The contract caps a batch at 120 — two minutes of on-job cadence. Buffering
 * more than that is pointless: a trail older than the cap is dropped anyway, and
 * an unbounded buffer on a handset that has been offline for an hour is a memory
 * and storage problem for a replay nobody will watch.
 */
export const MAX_BUFFERED = 120;

function read(): DriverLocationPing[] {
  const raw = storage.getString(BUFFER_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DriverLocationPing[]) : [];
  } catch {
    return [];
  }
}

function write(pings: DriverLocationPing[]): void {
  storage.set(BUFFER_KEY, JSON.stringify(pings));
}

/**
 * Appends a fix, dropping the OLDEST when full.
 *
 * Oldest-out, not newest-out. A trail with its beginning missing still shows
 * where the driver is now, which is what the customer is watching; dropping the
 * newest would leave the marker frozen in the past while fresh fixes were thrown
 * away at the door.
 */
export function bufferPing(ping: DriverLocationPing): void {
  const pings = read();
  pings.push(ping);
  write(pings.length > MAX_BUFFERED ? pings.slice(pings.length - MAX_BUFFERED) : pings);
}

/** Everything queued, oldest first — the order the server must receive it in. */
export function readBuffer(): DriverLocationPing[] {
  return read();
}

/**
 * Drops everything at or below `seq`.
 *
 * KEYED ON THE SERVER'S ANSWER, not on what was sent. The flush replies with the
 * sequence the server actually stored, so a partially-applied batch — some
 * accepted, some discarded as stale — clears exactly the right prefix. Clearing
 * the whole buffer on any 2xx would silently drop fixes the server rejected and
 * that a later retry could still have delivered in order.
 */
export function clearBufferedUpTo(seq: number): void {
  write(read().filter((ping) => ping.seq > seq));
}

export function clearBuffer(): void {
  storage.set(BUFFER_KEY, '[]');
}

/**
 * The next sequence number.
 *
 * MONOTONIC PER SESSION AND PERSISTED, because the server compares against what
 * it last stored and its hot hash outlives an app restart by 30 seconds. A
 * counter that reset to 1 on every launch would have every ping of the first
 * half-minute after a crash discarded as stale — precisely the window where a
 * crash means the trail matters.
 *
 * `goOnline` resets it, which is safe: the server writes no `seq` at go-online,
 * and a hash with no `seq` accepts the first ping whatever number it carries.
 */
export function nextSeq(): number {
  const current = Number(storage.getString(SEQ_KEY) ?? '0');
  const next = Number.isFinite(current) ? current + 1 : 1;
  storage.set(SEQ_KEY, String(next));
  return next;
}

/** Called at go-online, and after a flush whose server sequence ran ahead of ours. */
export function resetSeq(to = 0): void {
  storage.set(SEQ_KEY, String(to));
}

/**
 * Called on logout. A buffered fix has no session binding of its own, so on a
 * shared handset one driver's trail must not be flushed under the next driver's
 * token — the same reasoning `clearQueuedMutations` already applies.
 */
export function clearLocationState(): void {
  clearBuffer();
  resetSeq();
}
