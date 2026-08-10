import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ENV, type Env } from '../../config/env';
import { SENSITIVE_KEYS } from '../logging/logger.module';
import type { ErrorContext, ErrorReporterPort } from './error-reporter.port';

/**
 * Ships 5xx failures to Sentry (§15.5).
 *
 * INIT TIMING, and why late is right here. The SDK prefers `init()` before
 * anything else is imported, so its auto-instrumentation can patch http, pg and
 * friends on the way in. This service instead initialises in `onModuleInit`
 * with **all of that turned off** — no default integrations, no ESM loader
 * hooks, no tracing. That is a deliberate trade, not a compromise forced by the
 * house rule that constructors stay side-effect-free: we want error capture
 * from Sentry and latency from prom-client, and running two instrumentation
 * stacks over the same request path costs overhead for a second, blurrier copy
 * of numbers we already have. With instrumentation off, when `init()` runs
 * stops mattering — and the adapter keeps the same shape as every other port in
 * the codebase.
 *
 * Nest constructs BOTH adapters regardless of which the factory binds, which is
 * why nothing here happens in the constructor.
 */
@Injectable()
export class SentryErrorReporter implements ErrorReporterPort, OnModuleInit {
  private readonly logger = new Logger(SentryErrorReporter.name);
  private ready = false;

  constructor(@Inject(ENV) private readonly env: Env) {}

  onModuleInit(): void {
    if (!this.env.SENTRY_DSN) return;

    Sentry.init({
      dsn: this.env.SENTRY_DSN,
      environment: this.env.SENTRY_ENVIRONMENT ?? this.env.NODE_ENV,
      defaultIntegrations: false,
      registerEsmLoaderHooks: false,
      tracesSampleRate: 0,
      // Never IP addresses, cookies or headers by default. This service handles
      // Indian consumers' phone numbers and addresses; the failure mode of a
      // permissive default is a third party holding personal data nobody
      // decided to send them.
      sendDefaultPii: false,
      beforeSend: (event) => scrub(event) as Sentry.ErrorEvent,
    });

    this.ready = true;
    this.logger.log(`Error reporting enabled (${this.env.SENTRY_ENVIRONMENT ?? this.env.NODE_ENV})`);
  }

  capture(error: unknown, context: ErrorContext): void {
    if (!this.ready) return;

    try {
      Sentry.captureException(error, {
        tags: {
          route: context.route ?? 'unknown',
          method: context.method ?? 'unknown',
          status: String(context.status ?? 500),
        },
        // The same id in the response header, the access log and every app log
        // line for this request — so an issue leads straight to the logs.
        extra: { requestId: context.requestId },
      });
    } catch (sendError) {
      // The caller is the exception filter, mid-failure. Anything thrown here
      // would replace a well-formed error envelope with Nest's default body.
      this.logger.warn(`Could not report an error to Sentry: ${String(sendError)}`);
    }
  }
}

/**
 * Removes anything matching the logger's redaction list, wherever it appears.
 *
 * The list is imported rather than restated: one list, two consumers. A secret
 * field added to pino's redaction but not here would be censored in the logs and
 * shipped verbatim to a third party — the worse half of the pair, and the half
 * nobody would notice.
 */
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map((entry) => scrub(entry, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.some((needle) => key.toLowerCase() === needle.toLowerCase())
      ? '[redacted]'
      : scrub(entry, depth + 1);
  }
  return result;
}
