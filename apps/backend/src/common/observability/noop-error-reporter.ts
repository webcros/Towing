import { Injectable } from '@nestjs/common';
import type { ErrorContext, ErrorReporterPort } from './error-reporter.port';

/**
 * The permanent local and test implementation — the standing of `DevOtpAdapter`
 * and `LogNotificationAdapter`, not a placeholder.
 *
 * Nothing is lost by doing nothing here: the exception filter has already
 * logged the error with its stack and request id before calling this, so the
 * failure is fully recorded either way. All the reporter adds is delivery to
 * somewhere a human is watching.
 */
@Injectable()
export class NoopErrorReporter implements ErrorReporterPort {
  capture(_error: unknown, _context: ErrorContext): void {
    // Intentionally empty.
  }
}
