import { ArgumentsHost, Catch, Logger, type ExceptionFilter } from '@nestjs/common';
import { ErrorCodes } from '@towing/api-contracts';
import { ApiException } from '../common/errors/api-exception';
import type { FleetSocket } from './realtime.types';

/**
 * The WebSocket sibling `ErrorEnvelopeFilter` anticipates ("WebSocket/RPC
 * contexts have no response to write; the gateway phase adds its own filter").
 *
 * Emits the same `{ error: { code, message } }` envelope clients already parse
 * over HTTP, so a socket failure and a REST failure are the same shape. Never
 * emits a stack or an internal message — a socket is a long-lived channel to an
 * untrusted browser.
 */
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'ws') return;

    const client = host.switchToWs().getClient<FleetSocket>();
    const known = exception instanceof ApiException;

    this.logger.error(
      `socket error on ${client.id}: ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // `exception` is outside ServerToClientEvents on purpose — that type is the
    // catalogue of events the console subscribes to, and this is an out-of-band
    // channel every socket.io client understands.
    const raw = client as unknown as { emit: (event: string, payload: unknown) => void };
    raw.emit('exception', {
      error: known
        ? { code: exception.code, message: exception.message }
        : { code: ErrorCodes.INTERNAL, message: 'Realtime request failed' },
    });
  }
}
