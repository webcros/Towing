import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap() {
  // bufferLogs: boot-time lines (module init, env failures) flush through pino
  // once it is ready instead of bypassing the structured logger.
  //
  // rawBody: stashes the unparsed request bytes on `req.rawBody`, which is the
  // only thing a webhook HMAC can be computed over — a re-serialised JSON
  // object does not hash to the same bytes. Costs one Buffer per JSON request
  // app-wide; the alternative (bodyParser: false plus hand-registering
  // express.raw() before express.json()) means re-declaring every parser by
  // hand, which is a far bigger blast radius for one route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const env = app.get<Env>(ENV);

  /**
   * `req.ip` is the throttler's fallback tracker for every unauthenticated
   * request, so what Express believes about proxies is a security decision.
   *
   * Express's numeric form trusts the N hops NEAREST this server and takes the
   * first address beyond them. Setting it higher than the real hop count means
   * trusting an entry the CLIENT wrote — X-Forwarded-For is a request header
   * like any other. 0 (the default) trusts nothing and uses the socket peer,
   * which is why the value is opt-in per deployment rather than always on.
   */
  if (env.TRUST_PROXY_HOPS > 0) {
    app.set('trust proxy', env.TRUST_PROXY_HOPS);
  }

  app.setGlobalPrefix('v1');
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  // Socket.io transport. MUST precede listen(): listen() calls init()
  // implicitly, and an adapter installed after that is silently ignored — the
  // gateway would then run on the default in-memory adapter and stop
  // broadcasting across tasks with no error anywhere.
  app.useWebSocketAdapter(new RedisIoAdapter(app));
  // Without shutdown hooks the pg pool / redis connections never close on
  // SIGTERM, so ECS task drains would hit the 30s kill instead of exiting clean.
  app.enableShutdownHooks();

  await app.listen(env.PORT);
}

void bootstrap();
