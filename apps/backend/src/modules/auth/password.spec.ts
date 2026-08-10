import { describe, expect, it } from 'vitest';
import { hashPassword, verifyDecoyPassword, verifyPassword } from './password';

describe('password hashing (scrypt)', () => {
  it('verifies the password it hashed', async () => {
    const hash = await hashPassword('Password123!');
    await expect(verifyPassword('Password123!', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('Password123!');
    await expect(verifyPassword('Password123?', hash)).resolves.toBe(false);
  });

  it('produces a unique salt per hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
    await expect(verifyPassword('same', a)).resolves.toBe(true);
    await expect(verifyPassword('same', b)).resolves.toBe(true);
  });

  it('normalizes unicode (NFKC) so composed and decomposed forms match', async () => {
    const composed = 'påssword-secret'; // å as a single code point
    const decomposed = 'påssword-secret'; // a + combining ring
    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  it('fails closed on malformed stored hashes instead of throwing', async () => {
    for (const stored of [
      '',
      'not-a-hash',
      'bcrypt$10$whatever$xx',
      'scrypt$notanumber$8$1$c2FsdA$aGFzaA',
      // N above the DoS ceiling must be refused, not derived.
      'scrypt$1048576$8$1$c2FsdA$aGFzaA',
      // N not a power of two.
      'scrypt$10000$8$1$c2FsdA$aGFzaA',
    ]) {
      await expect(verifyPassword('anything', stored)).resolves.toBe(false);
    }
  });

  it('decoy verification always returns false but burns real work', async () => {
    const started = Date.now();
    await expect(verifyDecoyPassword('probe')).resolves.toBe(false);
    // scrypt at N=16384 cannot complete instantaneously; a broken decoy that
    // short-circuits would make unknown-email timing observable again.
    expect(Date.now() - started).toBeGreaterThan(2);
  });
});
