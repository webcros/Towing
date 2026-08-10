import { env } from '@/lib/env';
import { useAuthStore } from '@/features/auth/store/authStore';
import { toApiClientError } from './errors';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * One in-flight refresh at a time, module-level. The web BFF's
 * `createProxyHandler.ts` keys an equivalent map by refresh token because one
 * server process serves many concurrent sessions; a mobile client has exactly
 * one session, so the map degenerates to a single slot — simpler, same
 * property: two callers racing a 401 must not both call `/auth/refresh`, or
 * the backend's family reuse-detection reads the loser as token theft and
 * revokes the whole session.
 */
let inFlightRefresh: Promise<TokenPair | null> | null = null;

async function refreshSession(): Promise<TokenPair | null> {
  if (inFlightRefresh) return inFlightRefresh;

  const attempt = (async (): Promise<TokenPair | null> => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${env.apiBaseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as Partial<TokenPair>;
      if (!body.accessToken || !body.refreshToken) return null;
      return { accessToken: body.accessToken, refreshToken: body.refreshToken };
    } catch {
      return null;
    }
  })();

  inFlightRefresh = attempt;
  try {
    return await attempt;
  } finally {
    inFlightRefresh = null;
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Injects a fresh `Idempotency-Key` unless the caller already set one — replays MUST reuse the original. */
  idempotent?: boolean;
}

function withIdempotencyKey(headers: Headers, options?: ApiFetchOptions): void {
  if (!options?.idempotent) return;
  if (headers.has('Idempotency-Key')) return;
  // Deferred import: idempotency.ts pulls in expo-crypto, which client.ts's
  // callers don't all need loaded just to make a GET request.
  const { newIdempotencyKey } = require('./idempotency') as typeof import('./idempotency');
  headers.set('Idempotency-Key', newIdempotencyKey());
}

/** No Authorization header, no refresh handling — for the public OTP/social/refresh routes themselves. */
export async function publicFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type') && options?.body) headers.set('Content-Type', 'application/json');
  withIdempotencyKey(headers, options);

  const res = await fetch(`${env.apiBaseUrl}/v1/${path}`, { ...options, headers });
  if (!res.ok) throw await toApiClientError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * The authenticated path. Injects the bearer token, and on a 401 refreshes
 * once (serialized, see `refreshSession`) and retries the original request
 * exactly once before giving up.
 */
export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const call = async (accessToken: string): Promise<Response> => {
    const headers = new Headers(options?.headers);
    if (!headers.has('Content-Type') && options?.body) headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${accessToken}`);
    withIdempotencyKey(headers, options);
    return fetch(`${env.apiBaseUrl}/v1/${path}`, { ...options, headers });
  };

  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) throw await toApiClientError(new Response(null, { status: 401 }));

  let res = await call(accessToken);

  if (res.status === 401) {
    const rotated = await refreshSession();
    if (!rotated) {
      useAuthStore.getState().clearSession();
      throw await toApiClientError(res);
    }
    useAuthStore.getState().setTokens(rotated);
    res = await call(rotated.accessToken);
  }

  if (!res.ok) throw await toApiClientError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
