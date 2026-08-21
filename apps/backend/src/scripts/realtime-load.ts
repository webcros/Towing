import { randomBytes, randomUUID } from 'node:crypto';
import { FLEET_NAMESPACE } from '@towing/api-contracts';
import { Redis } from 'ioredis';
import { io, type Socket } from 'socket.io-client';
import { loadEnv } from '../config/env';
import { loadDotenv } from '../config/load-dotenv';
import { LOCATION_CHANNEL, wsTicketKey } from '../redis/redis.constants';

/**
 * Realtime load smoke (§19.1: "real-time propagation <= 2s p95").
 *
 * Run with `pnpm smoke:realtime`. Exits non-zero if the SLO is missed, so it can
 * gate a release rather than merely printing numbers.
 *
 * Two design choices worth knowing:
 *
 *  - Tickets are written STRAIGHT INTO REDIS, not fetched over HTTP. Minting 50
 *    of them through the endpoint would measure the throttler and the JWT path,
 *    neither of which the SLO is about. `--via-http` exercises the endpoint when
 *    that is what you want to test.
 *  - Pings are SYNTHETIC truck UUIDs, not seeded rows. The relay does zero
 *    database work per ping by design, so requiring 200 seeded trucks would test
 *    the seed rather than the fan-out.
 */

interface Args {
  clients: number;
  trucks: number;
  durationSec: number;
  intervalMs: number;
  gateways: string[];
  fleetId: string;
  p95BudgetMs: number;
  maxLossPct: number;
  viaHttp: boolean;
  /** 0 = never. §19.7's "WebSocket reconnect storm (mass network flap)". */
  reconnectEverySec: number;
}

const DEFAULTS: Args = {
  clients: 50,
  trucks: 200,
  durationSec: 60,
  intervalMs: 1_000,
  gateways: ['http://localhost:4000'],
  fleetId: '',
  p95BudgetMs: 2_000,
  maxLossPct: 0.5,
  viaHttp: false,
  reconnectEverySec: 0,
};

const USAGE = [
  'realtime-load — 50 clients / 200 trucks, asserts p95 ping→client < 2s (§19.1)',
  '',
  '  pnpm smoke:realtime [options]',
  '',
  `  --clients=N      concurrent socket clients        (default ${DEFAULTS.clients})`,
  `  --trucks=N       synthetic trucks pinging         (default ${DEFAULTS.trucks})`,
  `  --duration=SEC   run length                       (default ${DEFAULTS.durationSec})`,
  `  --interval=MS    ping cadence per truck           (default ${DEFAULTS.intervalMs})`,
  '  --gateways=URL,URL   comma-separated gateway origins to spread clients over',
  '  --fleet=UUID     fleet id to use (default: a fresh random one)',
  `  --p95=MS         failure threshold                (default ${DEFAULTS.p95BudgetMs})`,
  '  --via-http       mint tickets through POST /v1/fleet/realtime/ticket',
  '  --reconnect-every=SEC   drop and re-handshake EVERY client on this cadence',
  '                          (§19.7 reconnect storm; 0 = never, the default)',
  '  --help',
].join('\n');

function parseArgs(argv: string[]): Args {
  // Annotated: `randomUUID()` returns a template-literal type that would
  // otherwise narrow `fleetId` and reject `--fleet=<uuid>`.
  const args: Args = { ...DEFAULTS, fleetId: randomUUID() };
  for (const arg of argv) {
    const [rawKey, rawValue] = arg.split('=');
    const value = rawValue ?? '';
    switch (rawKey) {
      case '--clients':
        args.clients = Number(value);
        break;
      case '--trucks':
        args.trucks = Number(value);
        break;
      case '--duration':
        args.durationSec = Number(value);
        break;
      case '--interval':
        args.intervalMs = Number(value);
        break;
      case '--gateways':
        args.gateways = value.split(',').map((g) => g.trim()).filter(Boolean);
        break;
      case '--fleet':
        args.fleetId = value;
        break;
      case '--p95':
        args.p95BudgetMs = Number(value);
        break;
      case '--via-http':
        args.viaHttp = true;
        break;
      case '--reconnect-every':
        args.reconnectEverySec = Number(value);
        break;
      case '--help':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        break;
    }
  }
  return args;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? Number.NaN;
}

async function main(): Promise<void> {
  loadDotenv();
  const env = loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const redis = new Redis(env.REDIS_URL);
  redis.on('error', (err: Error) => console.error(`[load] redis: ${err.message}`));

  const truckIds = Array.from({ length: args.trucks }, () => randomUUID());

  /** Writes a ticket the way WsTicketService would; no HTTP, no throttler. */
  async function mintTicket(): Promise<string> {
    if (args.viaHttp) {
      const origin = args.gateways[0] ?? 'http://localhost:4000';
      const res = await fetch(`${origin}/v1/fleet/realtime/ticket`, { method: 'POST' });
      if (!res.ok) throw new Error(`ticket endpoint returned ${res.status}`);
      const body = (await res.json()) as { ticket: string };
      return body.ticket;
    }
    const ticket = randomBytes(32).toString('base64url');
    await redis.set(
      wsTicketKey(ticket),
      JSON.stringify({ realm: 'fleet', fleetId: args.fleetId, subjectId: randomUUID() }),
      'EX',
      120,
    );
    return ticket;
  }

  console.log(`[load] ${args.clients} clients · ${args.trucks} trucks · ${args.durationSec}s`);
  console.log(`[load] gateways ${args.gateways.join(', ')}`);
  console.log(`[load] fleet ${args.fleetId}`);

  const clientLatencies: number[] = [];
  const relayLatencies: number[] = [];
  /** truckId → count of frames received, per client, to detect duplication. */
  let framesReceived = 0;
  let positionsReceived = 0;
  const seenPerClient: Array<Map<string, number>> = [];

  const sockets: Socket[] = [];
  for (let i = 0; i < args.clients; i += 1) {
    const origin = args.gateways[i % args.gateways.length] ?? args.gateways[0];
    const ticket = await mintTicket();
    const seen = new Map<string, number>();
    seenPerClient.push(seen);

    const socket = io(`${origin}${FLEET_NAMESPACE}`, {
      auth: { ticket },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000,
    });

    socket.on('location:update', (frame: { positions: Array<{ truckId: string; at: string }>; emittedAt: string }) => {
      const now = Date.now();
      framesReceived += 1;
      const emittedAt = Date.parse(frame.emittedAt);
      for (const position of frame.positions) {
        positionsReceived += 1;
        const pingAt = Date.parse(position.at);
        // Client-observed latency assumes one clock; true for a local smoke.
        clientLatencies.push(now - pingAt);
        // Server-measured: the number worth gating CI on, since it is immune to
        // clock skew between the load generator and the gateway.
        relayLatencies.push(emittedAt - pingAt);
        seen.set(position.truckId, (seen.get(position.truckId) ?? 0) + 1);
      }
    });

    socket.on('connect_error', (err) => {
      console.error(`[load] client ${i} failed to connect: ${err.message}`);
    });

    sockets.push(socket);
  }

  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const connected = sockets.filter((s) => s.connected).length;
  console.log(`[load] ${connected}/${args.clients} clients connected`);
  if (connected === 0) {
    console.error('[load] no clients connected — is the backend running?');
    process.exit(1);
  }

  let pingsSent = 0;
  const ticker = setInterval(() => {
    const at = new Date().toISOString();
    const pipeline = redis.pipeline();
    for (const truckId of truckIds) {
      pipeline.publish(
        LOCATION_CHANNEL,
        JSON.stringify({
          fleetId: args.fleetId,
          truckId,
          lat: 12.9716 + Math.random() * 0.05,
          lng: 77.5946 + Math.random() * 0.05,
          heading: Math.random() * 360,
          speedKph: 20 + Math.random() * 30,
          at,
        }),
      );
      pingsSent += 1;
    }
    void pipeline.exec();
  }, args.intervalMs);

  /**
   * §19.7's "WebSocket reconnect storm (mass network flap)": every client drops
   * and re-handshakes at once, repeatedly, while the pings keep flowing.
   *
   * Each reconnect needs a FRESH ticket — they are single-use by design
   * (`getdel`), so replaying one would fail the handshake and the run would
   * measure nothing but a dead socket. The frames missed while a client is
   * re-establishing show up as loss, which is the point: `--max-loss` is what
   * turns this into a pass/fail gate rather than a demonstration.
   */
  let reconnectTicker: NodeJS.Timeout | undefined;
  let reconnects = 0;
  if (args.reconnectEverySec > 0) {
    reconnectTicker = setInterval(() => {
      void (async () => {
        for (const socket of sockets) {
          socket.disconnect();
          socket.auth = { ticket: await mintTicket() };
          socket.connect();
          reconnects += 1;
        }
      })();
    }, args.reconnectEverySec * 1_000);
  }

  await new Promise((resolve) => setTimeout(resolve, args.durationSec * 1_000));
  clearInterval(ticker);
  if (reconnectTicker) {
    clearInterval(reconnectTicker);
    console.log(`[load] ${reconnects} reconnects across the run`);
  }
  // Let the last flush window drain before measuring.
  await new Promise((resolve) => setTimeout(resolve, 2_500));

  for (const socket of sockets) socket.close();
  await redis.quit();

  const clientSorted = [...clientLatencies].sort((a, b) => a - b);
  const relaySorted = [...relayLatencies].sort((a, b) => a - b);

  // Each client should see each truck at most once per flush window. More than
  // that on a multi-gateway run is the signature of a non-local emit.
  const expectedFramesPerClient = Math.floor((args.durationSec * 1_000) / args.intervalMs);
  let duplicates = 0;
  for (const seen of seenPerClient) {
    for (const count of seen.values()) {
      if (count > expectedFramesPerClient + 2) duplicates += 1;
    }
  }

  const uniqueTrucksSeen = new Set<string>();
  for (const seen of seenPerClient) for (const truckId of seen.keys()) uniqueTrucksSeen.add(truckId);
  const lossPct =
    truckIds.length === 0 ? 0 : 100 * (1 - uniqueTrucksSeen.size / truckIds.length);

  const p95 = percentile(clientSorted, 95);
  const relayP95 = percentile(relaySorted, 95);

  console.log(`[load] sent ${pingsSent} pings · ${framesReceived} frames · ${positionsReceived} positions`);
  console.log(`[load] truck coverage ${uniqueTrucksSeen.size}/${truckIds.length} · loss ${lossPct.toFixed(2)}%`);
  console.log(
    `[load] client latency  p50 ${percentile(clientSorted, 50)}ms  p95 ${p95}ms  p99 ${percentile(clientSorted, 99)}ms`,
  );
  console.log(
    `[load] relay latency   p50 ${percentile(relaySorted, 50)}ms  p95 ${relayP95}ms  p99 ${percentile(relaySorted, 99)}ms`,
  );
  console.log(`[load] duplicates ${duplicates}`);

  const failures: string[] = [];
  if (!(p95 < args.p95BudgetMs)) failures.push(`client p95 ${p95}ms >= ${args.p95BudgetMs}ms`);
  if (lossPct > args.maxLossPct) failures.push(`loss ${lossPct.toFixed(2)}% > ${args.maxLossPct}%`);
  if (duplicates > 0) failures.push(`${duplicates} duplicated truck streams (non-local emit?)`);

  if (failures.length > 0) {
    console.error(`FAIL  ${failures.join(' · ')}`);
    process.exit(1);
  }
  console.log(`PASS  p95 ${p95}ms < ${args.p95BudgetMs}ms · loss ${lossPct.toFixed(2)}% · duplicates 0`);
  process.exit(0);
}

void main().catch((err: unknown) => {
  console.error('[load] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
