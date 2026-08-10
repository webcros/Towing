import type {
  BookingStatusEvent,
  FleetId,
  LocationUpdateEvent,
  OpsMetricsEvent,
  RealtimeReadyEvent,
} from '@towing/api-contracts';
import type { Namespace, Server, Socket } from 'socket.io';

/**
 * Typed Socket.io surface for the `/fleet` namespace.
 *
 * `ClientToServerEvents` is deliberately EMPTY. Phase 5 ships zero
 * `@SubscribeMessage` handlers: room membership is derived solely from the
 * verified handshake claim, so nothing client-supplied can ever reach a room
 * name. That is the WebSocket analogue of `FleetScopeGuard`, and keeping the
 * type empty is what makes adding an inbound handler a deliberate decision
 * rather than an accident.
 */
export interface ClientToServerEvents {
  // intentionally empty — see above
}

export interface ServerToClientEvents {
  'realtime:ready': (payload: RealtimeReadyEvent) => void;
  'location:update': (payload: LocationUpdateEvent) => void;
  'booking:status': (payload: BookingStatusEvent) => void;
  'ops:metrics': (payload: OpsMetricsEvent) => void;
}

/** Attached at handshake; the only source of truth for a socket's tenant. */
export interface FleetSocketData {
  fleetId: FleetId;
  userId: string;
}

export type FleetSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  FleetSocketData
>;

export type FleetNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  FleetSocketData
>;

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  FleetSocketData
>;
