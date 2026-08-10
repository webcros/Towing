import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv, type Env } from '../../config/env';
import { fleetOwnerCredentials, fleets } from '../../db/schema';
import {
  seedFleet,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { realmRegistry } from '../../test/auth';
import { closeTestRedis, testRedis } from '../../test/redis';
import { AuthService } from './auth.service';
import type { OtpPort } from './otp.port';
import { hashPassword } from './password';
import { RefreshGraceService } from './refresh-grace.service';
import { TokenService } from './token.service';

const PASSWORD = 'CorrectHorse9!';
const GENERIC_REJECTION = 'Email or password is incorrect';

/** Captures codes instead of sending them — the test's SMS inbox. */
class CaptureOtpAdapter implements OtpPort {
  codes: string[] = [];
  async send(_phone: string, code: string): Promise<void> {
    this.codes.push(code);
  }
  last(): string {
    const code = this.codes[this.codes.length - 1];
    if (!code) throw new Error('no OTP captured');
    return code;
  }
}

describe('AuthService (fleet console login, §16.4)', () => {
  let db: TestDatabase;
  let env: Env;
  let otp: CaptureOtpAdapter;
  let auth: AuthService;
  let userId: string;
  let fleetId: string;
  const email = 'owner@fleet.test';

  beforeAll(async () => {
    db = await setupTestDatabase();
    env = loadEnv();
  });

  // The grace service holds a real (if unused) client; left open it keeps the
  // event loop alive and vitest never exits.
  afterAll(async () => {
    await closeTestRedis();
  });

  beforeEach(async () => {
    await truncateAll();
    otp = new CaptureOtpAdapter();
    const tokens = new TokenService(
      db as never,
      env,
      new JwtService({
        secret: env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
      }),
      // Grace window off: this file asserts the AuthService facade, and the
      // window has its own spec. `refresh-grace.e2e.spec.ts` covers it on.
      new RefreshGraceService(testRedis(), { ...env, REFRESH_GRACE_SECONDS: 0 }),
      realmRegistry(db),
    );
    auth = new AuthService(db as never, env, otp, tokens);

    ({ ownerId: userId, fleetId } = await seedFleet(db, 'Auth Test Fleet'));
    await db.insert(fleetOwnerCredentials).values({
      userId,
      email,
      passwordHash: await hashPassword(PASSWORD),
    });
  });

  it('completes the full login: password → challenge → OTP → session → me', async () => {
    const challenge = await auth.login({ email, password: PASSWORD });
    expect(challenge.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(otp.codes).toHaveLength(1);

    const session = await auth.verify({ challengeId: challenge.challengeId, otp: otp.last() });
    expect(session.fleet).toMatchObject({ id: fleetId, businessName: 'Auth Test Fleet' });
    expect(session.accessToken.split('.')).toHaveLength(3);

    const me = await auth.me(fleetId, userId);
    expect(me.fleet.id).toBe(fleetId);
    expect(me.owner.id).toBe(userId);
  });

  it('rejects unknown email and wrong password with the same message (no enumeration)', async () => {
    await expect(auth.login({ email: 'nobody@fleet.test', password: PASSWORD })).rejects.toThrow(
      GENERIC_REJECTION,
    );
    await expect(auth.login({ email, password: 'WrongPass99!' })).rejects.toThrow(
      GENERIC_REJECTION,
    );
  });

  it('locks the account after 5 failed attempts — the correct password stops working', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(auth.login({ email, password: 'WrongPass99!' })).rejects.toThrow(
        GENERIC_REJECTION,
      );
    }

    // Correct password, locked account: same generic message on purpose.
    await expect(auth.login({ email, password: PASSWORD })).rejects.toThrow(GENERIC_REJECTION);
  });

  it('a successful login resets the failed-attempt counter', async () => {
    for (let i = 0; i < 3; i += 1) {
      await auth.login({ email, password: 'WrongPass99!' }).catch(() => {});
    }
    await auth.login({ email, password: PASSWORD });

    const [row] = await db
      .select({ failedAttempts: fleetOwnerCredentials.failedAttempts })
      .from(fleetOwnerCredentials)
      .where(eq(fleetOwnerCredentials.email, email));
    expect(row!.failedAttempts).toBe(0);
  });

  it('rejects a wrong OTP, then caps guesses at OTP_MAX_ATTEMPTS', async () => {
    const { challengeId } = await auth.login({ email, password: PASSWORD });
    const good = otp.last();
    const bad = good === '000000' ? '000001' : '000000';

    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i += 1) {
      await expect(auth.verify({ challengeId, otp: bad })).rejects.toMatchObject({
        code: 'unauthorized',
      });
    }

    // Attempts exhausted: even the correct code is refused now.
    await expect(auth.verify({ challengeId, otp: good })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('a challenge is single-use — replaying code + challenge fails', async () => {
    const { challengeId } = await auth.login({ email, password: PASSWORD });
    const code = otp.last();

    await auth.verify({ challengeId, otp: code });
    await expect(auth.verify({ challengeId, otp: code })).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('refuses login for a suspended fleet with an actionable message', async () => {
    await db.update(fleets).set({ status: 'suspended' }).where(eq(fleets.id, fleetId));

    await expect(auth.login({ email, password: PASSWORD })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('refresh rotates and logout revokes through the service facade', async () => {
    const { challengeId } = await auth.login({ email, password: PASSWORD });
    const session = await auth.verify({ challengeId, otp: otp.last() });

    const rotated = await auth.refresh(session.refreshToken);
    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    await auth.logout(rotated.refreshToken);
    await expect(auth.refresh(rotated.refreshToken)).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });
});
