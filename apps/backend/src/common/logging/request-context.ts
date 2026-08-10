import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** The same id in `x-request-id`, the access log and every app log line. */
  requestId: string;
  /** Milliseconds spent inside SQL for this request so far. */
  dbMs: number;
  /** Number of statements issued for this request so far. */
  dbCalls: number;
}

/**
 * Per-request state for code too deep to be handed a request.
 *
 * The query-timing wrapper sits inside the postgres.js client, several layers
 * below anything that knows an HTTP request exists — but a slow query is
 * useless without knowing which request produced it. `AsyncLocalStorage`
 * carries the id across every await between the two without threading a
 * parameter through the repos.
 *
 * Deliberately narrow: an id and two counters. It is not a general-purpose
 * request-scoped container, and adding one would invite exactly the kind of
 * hidden coupling the repos were written to avoid.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Undefined outside a request — a cron job, a queue worker, a script. */
export function currentRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/** Records one statement against the request in flight, if there is one. */
export function recordDbCall(durationMs: number): void {
  const store = requestContext.getStore();
  if (!store) return;

  store.dbMs += durationMs;
  store.dbCalls += 1;
}
