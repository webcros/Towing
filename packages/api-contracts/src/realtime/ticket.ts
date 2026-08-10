import { z } from 'zod';

/**
 * `POST /v1/fleet/realtime/ticket` — the browser holds only httpOnly cookies, so
 * it can never present a bearer to the WebSocket handshake. It asks the BFF
 * proxy for a short-lived, single-use ticket instead and passes that in
 * `io(url, { auth: { ticket } })`.
 *
 * The ticket is an opaque random string, NOT a JWT: a token signed with
 * `JWT_ACCESS_SECRET` carrying `role: 'fleet_owner'` would be indistinguishable
 * from a real access token to `JwtAuthGuard`.
 */
export const wsTicketResponseSchema = z.object({
  ticket: z.string().min(32),
  expiresInSeconds: z.number().int().positive(),
  /**
   * Absolute origin of the realtime gateway, resolved server-side. Deliberately
   * NOT a `NEXT_PUBLIC_*` var: those are inlined at `next build`, so moving the
   * gateway to its own service would force a web image rebuild.
   */
  wsUrl: z.url(),
  namespace: z.string(),
});
export type WsTicketResponse = z.infer<typeof wsTicketResponseSchema>;
