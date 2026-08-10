import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app';
import { setupTestDatabase } from '../../test/db';
import { closeTestRedis } from '../../test/redis';
import { ERROR_REPORTER } from './error-reporter.port';
import { NoopErrorReporter } from './noop-error-reporter';
import { SENSITIVE_KEYS } from '../logging/logger.module';

describe('error reporting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  /**
   * The guarantee that a test run can never talk to a third party.
   *
   * A future refactor of the factory — "simplify it to just check the DSN" —
   * would make a developer with SENTRY_DSN exported in their shell start
   * shipping test failures to a real project. This assertion is what stops that
   * refactor from landing quietly.
   */
  it('binds the noop reporter under NODE_ENV=test, whatever the DSN says', () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';

    try {
      expect(app.get(ERROR_REPORTER)).toBeInstanceOf(NoopErrorReporter);
    } finally {
      delete process.env.SENTRY_DSN;
    }
  });

  it('reports nothing and throws nothing', () => {
    const reporter = app.get<NoopErrorReporter>(ERROR_REPORTER);

    // The port's contract: synchronous, never throws. The exception filter calls
    // this while already handling a failure, so a throw here would replace a
    // well-formed error envelope with Nest's default body.
    expect(() => reporter.capture(new Error('boom'), { requestId: 'r1' })).not.toThrow();
    expect(reporter.capture(new Error('boom'), {})).toBeUndefined();
  });

  it('shares one sensitive-key list with the logger', () => {
    // One list, two consumers. A secret redacted in the logs but shipped
    // verbatim to Sentry is the worse half of the pair and the half nobody
    // would notice, so the Sentry adapter imports this rather than restating it.
    expect(SENSITIVE_KEYS).toContain('password');
    expect(SENSITIVE_KEYS).toContain('refreshToken');
    expect(SENSITIVE_KEYS).toContain('otp');
  });
});
