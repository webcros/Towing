/** Where an unexpected failure goes, beyond the log. */
export interface ErrorReporterPort {
  /**
   * ⚠ SYNCHRONOUS, FIRE-AND-FORGET, AND MUST NEVER THROW.
   *
   * The only caller is the global exception filter, which is already handling a
   * failure. If reporting could throw, the filter would fail while formatting
   * the response to a failure — and the client would get Nest's default body
   * instead of the envelope every client parses. If it could be awaited, a
   * slow or unreachable reporting service would add its latency to every 500.
   *
   * Implementations swallow their own errors. There is nothing useful a caller
   * could do with one anyway.
   */
  capture(error: unknown, context: ErrorContext): void;
}

export interface ErrorContext {
  requestId?: string;
  method?: string;
  /** Route PATTERN, never the concrete URL — ids in an issue title fragment it. */
  route?: string;
  status?: number;
}

/** DI token — the adapter is chosen per environment in `ObservabilityModule`. */
export const ERROR_REPORTER = Symbol('ERROR_REPORTER');
