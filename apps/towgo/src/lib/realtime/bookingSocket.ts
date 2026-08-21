import { io, type Socket } from 'socket.io-client';
import type {
  CustomerBookingStatusEvent,
  SearchProgressEvent,
  WsTicketResponse,
} from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import { env } from '@/lib/env';

/**
 * The `/customer` socket (§16.6) — Phase 17.
 *
 * WHAT IT BUYS OVER THE POLL. `useBooking` already refetches every ten seconds
 * (§19.2's fallback) and that carries the same search state, so this is not the
 * difference between knowing and not knowing — it is the difference between
 * seeing a wave advance and seeing roughly every other one. §9.1.6's acceptance
 * criterion is "wave transitions reflect the actual engine state", and a search
 * that widens every twenty seconds needs a channel faster than a ten-second
 * poll to reflect it honestly.
 *
 * IT DEGRADES TO NOTHING GRACEFULLY. A failed ticket, a refused handshake,
 * `REALTIME_ENABLED=false` or §19.8's force-polling switch all leave the poll
 * doing its job — which is why none of the failures below surface to the UI.
 *
 * ⚠ NEVER RUN ON A DEVICE. No dev-client build exists for this app.
 */

let socket: Socket | null = null;
let currentBookingId: string | null = null;

export interface BookingSocketHandlers {
  onSearchProgress: (progress: SearchProgressEvent) => void;
  onBookingStatus: (status: CustomerBookingStatusEvent) => void;
}

/**
 * Connects for ONE booking.
 *
 * The booking id is baked into the ticket server-side, so a socket cannot be
 * redirected at another booking after the fact — which is also why switching
 * bookings means tearing this down and minting a new ticket rather than
 * "joining" a different room.
 */
export async function connectBookingSocket(
  bookingId: string,
  handlers: BookingSocketHandlers,
): Promise<void> {
  if (currentBookingId === bookingId && socket) return;
  disconnectBookingSocket();

  let ticket: WsTicketResponse;
  try {
    ticket = await apiFetch<WsTicketResponse>(`bookings/${bookingId}/realtime/ticket`, {
      method: 'POST',
    });
  } catch {
    // §19.2 / §19.8: realtime is off, or an operator forced polling. The poll is
    // unaffected and already carries the same facts, so there is nothing to tell
    // the customer.
    return;
  }

  const next = io(`${ticket.wsUrl}${ticket.namespace}`, {
    transports: ['websocket'],
    auth: { ticket: ticket.ticket },
    /**
     * RECONNECTION OFF, because the ticket is SINGLE-USE. socket.io's built-in
     * retry replays the same handshake auth, so every automatic reconnect would
     * present an already-redeemed ticket and be refused — a loop that burns
     * battery and can never succeed. The screen re-invokes this on focus
     * instead, which mints a fresh ticket.
     */
    reconnection: false,
    timeout: 8_000,
  });

  next.on('search:progress', handlers.onSearchProgress);
  next.on('booking:status', handlers.onBookingStatus);
  next.on('disconnect', () => {
    socket = null;
    currentBookingId = null;
  });

  socket = next;
  currentBookingId = bookingId;
}

export function disconnectBookingSocket(): void {
  socket?.disconnect();
  socket = null;
  currentBookingId = null;
}

export function isBookingSocketConnected(): boolean {
  return socket?.connected === true;
}

/** Whether the app should even try. Mock mode has no server to connect to. */
export const bookingSocketEnabled = !env.useMocks;
