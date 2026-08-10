import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ErrorCodes, type ApiError } from '@towing/api-contracts';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { REQUEST_ID_HEADER, resolveRequestId } from '../logging/request-id.middleware';
import { ERROR_REPORTER, type ErrorReporterPort } from '../observability/error-reporter.port';
import { ApiException } from './api-exception';

/**
 * Framework-thrown HttpExceptions (guards, the throttler, unmatched routes)
 * have no `code`, so status is the only signal available to map them onto the
 * shared vocabulary in `ErrorCodes`.
 */
const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ErrorCodes.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCodes.VALIDATION_FAILED,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.RATE_LIMITED,
};

/** Never sent to a client — the real cause goes to the log, keyed by request id. */
const OPAQUE_500 = 'An unexpected error occurred';

/**
 * Terminates every request that throws, in the one envelope shape the clients
 * parse (`apiErrorSchema`, spec §16). Registered with a bare `@Catch()` so
 * nothing — not even a thrown string — can reach Nest's default handler and
 * emit a differently-shaped body.
 */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorEnvelopeFilter');

  constructor(@Inject(ERROR_REPORTER) private readonly reporter: ErrorReporterPort) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // WebSocket/RPC contexts have no response to write; the gateway phase adds
    // its own filter. Losing the log line here would hide the failure entirely.
    if (host.getType() !== 'http') {
      this.logger.error(`Non-HTTP exception: ${describe(exception)}`, stackOf(exception));
      this.reporter.capture(exception, {});
      return;
    }

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { status, body } = toEnvelope(exception);
    const requestId = resolveRequestId(req);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${req.method} ${req.originalUrl} -> ${status} ${describe(exception)}`,
        stackOf(exception),
      );
      // 5xx ONLY, on the same argument this file already makes for logging 4xx
      // at debug: a client mistake is not an incident, and a stream of
      // validation failures would bury the one real bug in the same window.
      // `capture` never throws and is never awaited — see the port.
      this.reporter.capture(exception, {
        requestId,
        method: req.method,
        route: req.route?.path ?? req.originalUrl,
        status,
      });
    } else {
      // 4xx are client mistakes; at warn+ they would bury real incidents.
      this.logger.debug(
        `[${requestId}] ${req.method} ${req.originalUrl} -> ${status} ${body.error.code}`,
      );
    }

    // A stream that already started (file download, SSE) cannot be re-headered.
    if (res.headersSent) {
      res.end();
      return;
    }

    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.status(status).json(body);
  }
}

function toEnvelope(exception: unknown): { status: number; body: ApiError } {
  if (exception instanceof ApiException) {
    return {
      status: exception.getStatus(),
      body: envelope(exception.code, exception.message, exception.details),
    };
  }

  // Reached when a service parses with `.parse()` instead of going through
  // ZodValidationPipe — still the client's fault, so keep it a 422.
  if (exception instanceof z.core.$ZodError) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      body: envelope(
        ErrorCodes.VALIDATION_FAILED,
        'Request validation failed',
        z.flattenError(exception),
      ),
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const fallbackCode =
      status >= HttpStatus.INTERNAL_SERVER_ERROR ? ErrorCodes.INTERNAL : ErrorCodes.VALIDATION_FAILED;
    const { message, details } = unwrapHttpException(exception);
    return {
      status,
      body: envelope(
        CODE_BY_STATUS[status] ?? fallbackCode,
        status >= HttpStatus.INTERNAL_SERVER_ERROR ? OPAQUE_500 : message,
        details,
      ),
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: envelope(ErrorCodes.INTERNAL, OPAQUE_500),
  };
}

function envelope(code: string, message: string, details?: unknown): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/**
 * Nest exceptions carry either a string body or `{ statusCode, message, error }`,
 * and ApiException-shaped bodies can arrive here via `HttpException` subclasses
 * thrown by libraries. Normalise all of them to one message + optional details.
 */
function unwrapHttpException(exception: HttpException): { message: string; details?: unknown } {
  const response = exception.getResponse();
  if (typeof response === 'string') return { message: response };

  const record = response as Record<string, unknown>;
  const nested = record['error'];
  if (isRecord(nested) && typeof nested['message'] === 'string') {
    return { message: nested['message'], details: nested['details'] };
  }

  const raw = record['message'];
  if (Array.isArray(raw)) return { message: raw.join('; '), details: raw };
  if (typeof raw === 'string') return { message: raw, details: record['details'] };

  return { message: exception.message, details: record['details'] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function describe(exception: unknown): string {
  if (exception instanceof Error) return `${exception.name}: ${exception.message}`;
  try {
    return typeof exception === 'object' && exception !== null
      ? JSON.stringify(exception)
      : String(exception);
  } catch {
    return '<unserializable throwable>';
  }
}

function stackOf(exception: unknown): string | undefined {
  return exception instanceof Error ? exception.stack : undefined;
}
