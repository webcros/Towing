import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay's webhook signature scheme: `HMAC-SHA256(rawBody, secret)`, hex.
 *
 * Shared by BOTH adapters on purpose. The dev adapter verifying with the same
 * algorithm is what makes "the signature-verification code path is ready" a
 * fact rather than a promise — the path is exercised end to end in every local
 * run and every CI run, not only once real credentials exist.
 */
export function signWebhook(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Constant-time comparison of a hex signature.
 *
 * Two traps handled here rather than at each call site:
 *  - `timingSafeEqual` THROWS on buffers of different lengths, so a truncated
 *    or garbage signature would surface as a 500 instead of a clean 401;
 *  - a malformed hex string decodes to a shorter buffer, hitting the same trap.
 * Any failure is a rejection, never an exception.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;

  try {
    const expected = Buffer.from(signWebhook(rawBody, secret), 'hex');
    const received = Buffer.from(signature.trim(), 'hex');
    if (expected.length !== received.length || received.length === 0) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
