import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../errors/api-exception';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

/**
 * §19.4: "All mutating booking/money endpoints require an `Idempotency-Key`".
 *
 * The key travels in the HEADER, never the body. A body field would be a
 * *second* key that can disagree with the one `IdempotencyInterceptor` already
 * keys its Redis entry on, and then which of the two wins is a coin flip — the
 * kind of ambiguity that only shows up during an incident.
 *
 * "Required at the DTO layer" in the sense that matters: a handler cannot
 * compile without asking for it, and a request cannot succeed without sending
 * it. The interceptor stays header-driven and untouched.
 */
const idempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<Request>();
  const raw = request.headers[IDEMPOTENCY_HEADER];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();

  if (!value) {
    throw ApiException.validation(
      'An Idempotency-Key header is required for this operation',
      { header: IDEMPOTENCY_HEADER },
    );
  }

  // Bounded so a caller cannot use the key as free storage in Redis or in the
  // `payouts.idempotency_key` index.
  if (value.length > 255) {
    throw ApiException.validation('Idempotency-Key must be 255 characters or fewer');
  }

  return value;
});

export const IdempotencyKey = (): ParameterDecorator => idempotencyKey();
