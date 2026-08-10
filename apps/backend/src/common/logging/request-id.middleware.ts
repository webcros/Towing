import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * An inbound id is echoed into log lines and back out as a response header, so
 * accepting it verbatim is a log-injection and header-splitting vector. Only
 * bounded, opaque tokens survive; anything else gets a fresh UUID.
 */
const SANE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** `id` is stamped on the raw IncomingMessage so pino-http and Express agree. */
type IdentifiableRequest = IncomingMessage & { id?: unknown };

/**
 * Idempotent: returns the id already on the request when there is one, so the
 * middleware and pino-http's `genReqId` cannot mint competing ids regardless of
 * which of the two runs first.
 */
export function resolveRequestId(req: IncomingMessage): string {
  const existing = (req as IdentifiableRequest).id;
  if (typeof existing === 'string' && SANE_REQUEST_ID.test(existing)) return existing;

  const inbound = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
  if (candidate !== undefined && SANE_REQUEST_ID.test(candidate)) return candidate;

  return randomUUID();
}

/** Read-only lookup for code that must not mint an id (e.g. the error filter). */
export function getRequestId(req: IncomingMessage): string | undefined {
  const existing = (req as IdentifiableRequest).id;
  return typeof existing === 'string' ? existing : undefined;
}

/**
 * One id ties the access log, every app log line for the request, and the
 * client's copy of the failure together — without it a user-reported error is
 * unsearchable.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = resolveRequestId(req);
    (req as Request & { id: string }).id = id;
    res.setHeader(REQUEST_ID_HEADER, id);

    // Opening the async context here — rather than in an interceptor — is what
    // makes it cover the guards and pipes too, so a slow query in
    // `ProfileCompleteGuard` is still attributable to a request.
    requestContext.run({ requestId: id, dbMs: 0, dbCalls: 0 }, next);
  }
}
