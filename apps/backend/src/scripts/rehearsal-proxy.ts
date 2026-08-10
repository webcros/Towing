import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';

/**
 * The local stand-in for the ALB, for the multi-instance rehearsal
 * (`docs/rehearsal.md`).
 *
 * Round-robins HTTP and WebSocket traffic across N backends and N Next
 * processes, so the console can be driven end to end against more than one of
 * each — which is the only way to find out whether anything still holds state
 * in a process.
 *
 * WHY NOT NGINX. Reaching host processes from a container on Windows means
 * `host.docker.internal` and an extra NAT hop, which distorts the very
 * latencies the rehearsal exists to observe, and makes the config
 * platform-specific. Ninety lines of `node:http` rehearse exactly the two load
 * balancer behaviours that matter here — round-robin and an appended
 * `X-Forwarded-For` — and nothing else. Same standing as `realtime-load.ts` and
 * `simulate-locations.ts`: a development tool that runs from source via tsx.
 *
 * IT LISTENS ON 4000 AND 3000 ON PURPOSE — the ports everything already points
 * at. `PUBLIC_WS_URL`, `API_BASE_URL`, `CORS_ORIGINS` and Playwright's
 * `baseURL` all stay exactly as they are; only the real servers move aside.
 */

interface Args {
  apiPort: number;
  webPort: number;
  apiTargets: string[];
  webTargets: string[];
  sticky: boolean;
}

const DEFAULTS: Args = {
  apiPort: 4000,
  webPort: 3000,
  apiTargets: ['http://127.0.0.1:4001', 'http://127.0.0.1:4002'],
  webTargets: ['http://127.0.0.1:3001', 'http://127.0.0.1:3002'],
  sticky: false,
};

const USAGE = [
  'rehearsal-proxy — round-robins the console and the API across two instances each',
  '',
  '  pnpm --filter @towing/backend exec tsx src/scripts/rehearsal-proxy.ts [options]',
  '',
  `  --api=URL,URL    backend targets      (default ${DEFAULTS.apiTargets.join(',')})`,
  `  --web=URL,URL    Next targets         (default ${DEFAULTS.webTargets.join(',')})`,
  `  --api-port=N     listen port for the API   (default ${DEFAULTS.apiPort})`,
  `  --web-port=N     listen port for the web   (default ${DEFAULTS.webPort})`,
  '  --sticky         pin each client IP to one target (OFF by default — the',
  '                   whole point of the rehearsal is proving we do not need it)',
  '  --help',
].join('\n');

function parseArgs(argv: string[]): Args {
  const args: Args = { ...DEFAULTS };
  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue ?? '';
    switch (key) {
      case '--api':
        args.apiTargets = splitList(value);
        break;
      case '--web':
        args.webTargets = splitList(value);
        break;
      case '--api-port':
        args.apiPort = Number(value);
        break;
      case '--web-port':
        args.webPort = Number(value);
        break;
      case '--sticky':
        args.sticky = true;
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

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** One balanced listener over a pool of upstreams. */
function createBalancer(name: string, targets: string[], sticky: boolean): http.Server {
  if (targets.length === 0) throw new Error(`${name}: no targets`);

  let cursor = 0;
  const pinned = new Map<string, number>();

  const pick = (clientKey: string): URL => {
    if (sticky) {
      const existing = pinned.get(clientKey);
      if (existing !== undefined) return new URL(targets[existing]!);
      const assigned = cursor++ % targets.length;
      pinned.set(clientKey, assigned);
      return new URL(targets[assigned]!);
    }
    return new URL(targets[cursor++ % targets.length]!);
  };

  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const target = pick(req.socket.remoteAddress ?? 'unknown');

    const upstream = http.request(
      {
        host: target.hostname,
        port: target.port,
        method: req.method,
        path: req.url,
        headers: forwardHeaders(req, target),
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );

    upstream.on('error', (error) => {
      console.error(`[proxy:${name}] ${target.host} — ${error.message}`);
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('upstream unavailable');
    });

    req.pipe(upstream);
  });

  /**
   * The WebSocket half. A 101 is not a normal response: the status line and
   * headers have to be written to the raw socket by hand before either side is
   * piped, because there is no `ServerResponse` to write them through. Getting
   * this wrong does not error — the socket simply never upgrades, and every
   * realtime assertion fails later with a timeout that says nothing about why.
   */
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const target = pick(req.socket.remoteAddress ?? 'unknown');

    const upstream = http.request({
      host: target.hostname,
      port: target.port,
      method: req.method,
      path: req.url,
      headers: forwardHeaders(req, target),
    });

    upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
      const headers = Object.entries(upstreamRes.headers)
        .flatMap(([key, value]) =>
          Array.isArray(value) ? value.map((v) => `${key}: ${v}`) : [`${key}: ${String(value)}`],
        )
        .join('\r\n');

      // Nagle off on both halves: a WebSocket frame is small and latency-
      // sensitive, and buffering one to fill a packet is exactly the delay the
      // realtime SLO is measured against.
      // `socket` is typed Duplex by the 'upgrade' signature but is always a
      // net.Socket in practice.
      (socket as Socket).setNoDelay(true);
      upstreamSocket.setNoDelay(true);

      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`);

      /**
       * The two head buffers travel in OPPOSITE directions, and getting that
       * backwards is why the first version of this failed every handshake:
       *
       *  - `upstreamHead` is upstream bytes already buffered when 'upgrade'
       *    fired, so it belongs to the CLIENT;
       *  - `head` is client bytes buffered before we had an upstream socket, so
       *    it belongs UPSTREAM — and it has to be written to the upgraded
       *    SOCKET, not to the ClientRequest, where it would have become request
       *    body on a request that has no body.
       */
      if (upstreamHead.length > 0) socket.write(upstreamHead);
      if (head.length > 0) upstreamSocket.write(head);

      upstreamSocket.pipe(socket);
      socket.pipe(upstreamSocket);
    });

    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());

    upstream.end();
  });

  return server;
}

/**
 * APPENDS the peer address to `X-Forwarded-For`, exactly as a real load
 * balancer does — never replaces it.
 *
 * This is what makes `TRUST_PROXY_HOPS=1` testable locally: with one appended
 * hop, Express's numeric `trust proxy` takes the entry immediately before ours,
 * so a browser that invents an `X-Forwarded-For` cannot choose its own `req.ip`
 * and evade a rate limit.
 */
function forwardHeaders(req: IncomingMessage, target: URL): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = { ...req.headers };
  const peer = req.socket.remoteAddress ?? '';
  const existing = req.headers['x-forwarded-for'];

  headers['x-forwarded-for'] = existing ? `${String(existing)}, ${peer}` : peer;
  headers['x-forwarded-proto'] = 'http';
  headers.host = target.host;

  return headers;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  createBalancer('api', args.apiTargets, args.sticky).listen(args.apiPort, () => {
    console.log(`[proxy] api  :${args.apiPort} → ${args.apiTargets.join(', ')}`);
  });

  createBalancer('web', args.webTargets, args.sticky).listen(args.webPort, () => {
    console.log(`[proxy] web  :${args.webPort} → ${args.webTargets.join(', ')}`);
  });

  console.log(`[proxy] sticky sessions ${args.sticky ? 'ON' : 'OFF'}`);
}

main();
