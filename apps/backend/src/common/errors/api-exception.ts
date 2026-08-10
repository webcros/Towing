import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodes } from '@towing/api-contracts';

/**
 * The only exception the application layer should throw (spec §16). Nest's
 * built-in exceptions carry a status but no stable `code`, and clients branch
 * on the code — status alone cannot distinguish "wrong OTP" from "expired
 * challenge". ErrorEnvelopeFilter falls back to a status→code map for
 * exceptions thrown by framework internals.
 */
export class ApiException extends HttpException {
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    // The HttpException body is already the wire envelope, so a route that
    // somehow bypasses the global filter still emits a valid `apiErrorSchema`.
    super({ error: details === undefined ? { code, message } : { code, message, details } }, status);
    // HttpException only adopts `message` from string bodies; with an object
    // body it falls back to the class name ("Api Exception"), which would then
    // leak into every envelope the filter builds from `exception.message`.
    this.message = message;
    this.code = code;
    this.details = details;
  }

  static unauthorized(message = 'Authentication required', details?: unknown): ApiException {
    return new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, message, details);
  }

  static forbidden(message = 'You do not have access to this resource', details?: unknown): ApiException {
    return new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, message, details);
  }

  static notFound(message = 'Resource not found', details?: unknown): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, message, details);
  }

  static conflict(message = 'Resource state conflict', details?: unknown): ApiException {
    return new ApiException(HttpStatus.CONFLICT, ErrorCodes.CONFLICT, message, details);
  }

  /**
   * 422 rather than 400: the request parsed as JSON but failed the schema, and
   * clients render field-level errors off `details` (spec §16).
   */
  static validation(message = 'Request validation failed', details?: unknown): ApiException {
    return new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCodes.VALIDATION_FAILED,
      message,
      details,
    );
  }

  static rateLimited(message = 'Too many requests', details?: unknown): ApiException {
    return new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCodes.RATE_LIMITED, message, details);
  }
}
