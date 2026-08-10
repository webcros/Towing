import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC signing for `GET/PUT /v1/files/:key` (Phase 11, §3.1).
 *
 * The method is part of the signed payload so a signature minted for a GET
 * (handed to the admin console to render a document) can never be replayed as
 * a PUT (which would let a viewer overwrite the file it was shown).
 */
export type SignableMethod = 'GET' | 'PUT';

export interface FileSignature {
  sig: string;
  exp: number;
}

function payload(method: SignableMethod, key: string, exp: number): string {
  return `${method}:${key}:${exp}`;
}

export function signFileUrl(
  secret: string,
  method: SignableMethod,
  key: string,
  ttlSeconds: number,
): FileSignature {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac('sha256', secret).update(payload(method, key, exp)).digest('base64url');
  return { sig, exp };
}

/**
 * Constant-time compare via `timingSafeEqual` — a `===` here would leak how
 * many leading bytes of a guessed signature were correct through response
 * timing, turning the HMAC into a byte-at-a-time oracle.
 */
export function verifyFileSignature(
  secret: string,
  method: SignableMethod,
  key: string,
  exp: number,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expected = createHmac('sha256', secret).update(payload(method, key, exp)).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, 'base64url');
  } catch {
    return false;
  }

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
