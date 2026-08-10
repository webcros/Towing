import { randomUUID } from 'expo-crypto';

/** One per mutation attempt — replays (mutation queue, retry) MUST reuse the original, never mint a new one. */
export function newIdempotencyKey(): string {
  return randomUUID();
}
