import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing for the fleet console (§16.4).
 *
 * scrypt from `node:crypto` rather than bcrypt/argon2: those are native modules,
 * and the deployment target is a slim container image built without a toolchain.
 * scrypt is memory-hard and ships with Node, so there is nothing to compile.
 *
 * Encoded form: `scrypt$N$r$p$salt$hash` (salt and hash base64url). Parameters
 * travel with the hash so they can be raised later without invalidating rows
 * written under the old cost.
 */

const ALGORITHM = 'scrypt';
const N = 16384;
const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

// 128 * N * r is scrypt's working set (~16 MiB at the defaults above). The ceiling
// is doubled so a future cost bump does not need a code change here.
const MAXMEM = 64 * 1024 * 1024;

// Upper bounds on parameters read back out of the database. A row with an absurd
// N would otherwise turn one login into a self-inflicted memory-exhaustion DoS.
const MAX_N = 32768;
const MAX_R = 8;
const MAX_P = 4;

/**
 * A real hash of a value nobody knows, used to keep the unknown-email branch of
 * login in the same timing class as the wrong-password branch (see AuthService).
 * It has to be a genuine scrypt output so the verification does the same work.
 */
const DECOY_HASH =
  'scrypt$16384$8$1$seBp2gyCtvikXyzAIxNs7w$85tRYSwNq2JCxjE4lDO8ORLXXJP_8rPvjGEteEwYqB4fS7UX3stSz6JrM3XJG0EILBXFLE4RWrj9tSAwCFtk9Q';

interface ScryptParams {
  n: number;
  r: number;
  p: number;
}

function derive(password: string, salt: Buffer, keyBytes: number, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      keyBytes,
      { N: params.n, r: params.r, p: params.p, maxmem: MAXMEM },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, { n: N, r: R, p: P });

  return [ALGORITHM, N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

/**
 * Constant-time comparison against a stored encoded hash. A malformed or
 * unsupported record verifies to `false` rather than throwing — a corrupt row
 * must fail the login, not 500 the endpoint.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;

  const derived = await derive(password, parsed.salt, parsed.expected.length, parsed.params);

  return timingSafeEqual(derived, parsed.expected);
}

/**
 * Burns one scrypt derivation without ever succeeding. Callers use this when
 * there is no credential row so the response time does not reveal that the
 * email is unknown.
 */
export async function verifyDecoyPassword(password: string): Promise<false> {
  await verifyPassword(password, DECOY_HASH);
  return false;
}

function parse(stored: string): { params: ScryptParams; salt: Buffer; expected: Buffer } | undefined {
  const parts = stored.split('$');
  if (parts.length !== 6) return undefined;

  const [algorithm, rawN, rawR, rawP, rawSalt, rawHash] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (algorithm !== ALGORITHM) return undefined;

  const params: ScryptParams = { n: Number(rawN), r: Number(rawR), p: Number(rawP) };
  if (!Number.isInteger(params.n) || params.n < 2 || params.n > MAX_N) return undefined;
  if (!Number.isInteger(params.r) || params.r < 1 || params.r > MAX_R) return undefined;
  if (!Number.isInteger(params.p) || params.p < 1 || params.p > MAX_P) return undefined;
  // scrypt requires N to be a power of two.
  if ((params.n & (params.n - 1)) !== 0) return undefined;

  const salt = Buffer.from(rawSalt, 'base64url');
  const expected = Buffer.from(rawHash, 'base64url');
  if (salt.length === 0 || expected.length === 0) return undefined;

  return { params, salt, expected };
}
