import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * The one-time-code primitives, shared by every OTP in the system.
 *
 * EXTRACTED IN PHASE 15, NOT WRITTEN FOR IT. These three functions existed as
 * byte-identical module-private copies in `auth.service.ts` and
 * `auth-public.service.ts`; Phase 15 needed a third for the booking OTP, and a
 * third copy of a security primitive is how two of them quietly stop matching.
 *
 * WHY SHA-256 WITH NO WORK FACTOR — the reasoning is `auth.service.ts`'s,
 * preserved verbatim because it is the thing most likely to be "improved" by
 * someone who has not thought it through: a 6-digit code carries ~20 bits of
 * entropy, so no KDF cost would meaningfully slow an offline search of the
 * whole space. What protects the code is the ATTEMPT CAP plus the TTL enforced
 * at verification, not the strength of the hash. Swapping in scrypt here would
 * buy nothing and cost every login a CPU-bound hash.
 */

/** A 6-digit code, zero-padded. `randomInt` is CSPRNG-backed; `Math.random` is not. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** The only thing ever persisted. Never store or log the code itself. */
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Constant-time comparison. A plain `===` on a hex digest leaks its matching
 * prefix through timing, which over enough attempts is a code.
 */
export function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  return left.length === right.length && timingSafeEqual(left, right);
}
