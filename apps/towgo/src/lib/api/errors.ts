import { apiErrorSchema } from '@towing/api-contracts';

/** Typed failure carrying the backend's stable error code (spec §16) — mirrors towfleet-web's ApiError. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Parses a failed response body against the shared envelope, falling back to a generic error. */
export async function toApiClientError(response: Response): Promise<ApiClientError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    return new ApiClientError(
      response.status,
      parsed.data.error.code,
      parsed.data.error.message,
      parsed.data.error.details,
    );
  }
  return new ApiClientError(response.status, 'internal_error', `Request failed (${response.status})`);
}
