import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env';
import { ExternalCallPolicy } from '../../http/external-call.policy';
import type { ChannelPort, ChannelResult, ChannelSendParams } from '../channel.port';

/**
 * FCM (Android) and APNs (iOS) via Expo's push service (§12.1).
 *
 * ⚠ NEVER EXECUTED AGAINST EXPO. Written against the documented request and
 * ticket shapes at https://docs.expo.dev/push-notifications/sending-notifications/
 * and exercised only by fakes. Sending needs no Expo credential — the access
 * token only raises rate limits — but a push that actually ARRIVES needs an FCM
 * server key and an APNs key uploaded to the Expo project, and neither exists
 * (see `ToBeDoneEhsan.md`). No push has been delivered to a device.
 *
 * THE TICKET IS NOT THE OUTCOME. `POST /push/send` returns a *ticket*; whether
 * the device actually took it comes back minutes later from
 * `POST /push/getReceipts`. In particular `DeviceNotRegistered` — the signal
 * that an app was uninstalled and the token is dead — arrives on the receipts
 * endpoint, not here. `notifications.push-receipts` polls for it; without that
 * job stale tokens would accumulate forever and the shared-handset
 * self-healing story would be fiction.
 */
@Injectable()
export class ExpoPushAdapter implements ChannelPort, OnModuleInit {
  readonly vendor = 'expo';
  readonly channel = 'push' as const;

  private readonly logger = new Logger(ExpoPushAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly policy: ExternalCallPolicy,
  ) {}

  /**
   * Credentials are checked HERE, never in the constructor: the module factory
   * instantiates both this and `LogPushAdapter` whichever one it ends up
   * binding, so a constructor that validated would break every `log` boot.
   * Same contract `RazorpayRouteAdapter` follows.
   */
  onModuleInit(): void {
    if (this.env.NOTIFY_PUSH_PROVIDER !== 'expo') return;
    if (!this.env.EXPO_ACCESS_TOKEN) {
      this.logger.warn(
        'EXPO_ACCESS_TOKEN is unset — sending still works but is rate-limited, and' +
          ' delivery additionally requires FCM/APNs keys on the Expo project',
      );
    }
  }

  async send(params: ChannelSendParams): Promise<ChannelResult> {
    const message: Record<string, unknown> = {
      to: params.to,
      title: params.rendered.title ?? undefined,
      body: params.rendered.body,
      data: params.data,
      // §12.3: high priority bypasses batching. On Android the channel id is
      // what actually carries the importance — `priority` alone will not wake a
      // Doze-mode device inside a 20-second window.
      priority: params.priority === 'high' ? 'high' : 'default',
      channelId: params.androidChannelId,
      sound: params.priority === 'high' ? 'default' : undefined,
    };

    try {
      const tickets = await this.policy.run<ExpoTicket[]>(
        {
          vendor: this.vendor,
          attempts: 3,
          backoffMs: 500,
          isRetryable: (error) => !(error instanceof ExpoPermanentError),
        },
        async (signal) => {
          const response = await fetch(this.env.EXPO_PUSH_URL, {
            method: 'POST',
            signal,
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
              ...(this.env.EXPO_ACCESS_TOKEN
                ? { authorization: `Bearer ${this.env.EXPO_ACCESS_TOKEN}` }
                : {}),
            },
            body: JSON.stringify([message]),
          });

          if (response.status === 400) {
            // A malformed message will be malformed on every retry.
            throw new ExpoPermanentError(`Expo rejected the message (${await response.text()})`);
          }
          if (!response.ok) {
            throw new Error(`Expo push returned ${response.status}`);
          }

          const body = (await response.json()) as { data?: ExpoTicket[] };
          return body.data ?? [];
        },
      );

      const ticket = tickets[0];
      if (!ticket) {
        return {
          ok: false,
          vendor: this.vendor,
          retryable: true,
          code: 'no_ticket',
          message: 'Expo returned no ticket for the message',
        };
      }

      if (ticket.status === 'error') {
        const code = ticket.details?.error ?? 'unknown';
        return {
          ok: false,
          vendor: this.vendor,
          // `DeviceNotRegistered` here (rather than on the receipt) means the
          // token was already known-dead. Either way it must never be retried:
          // the device is gone, and the dispatcher revokes the row.
          retryable: code !== 'DeviceNotRegistered' && code !== 'InvalidCredentials',
          code,
          message: ticket.message ?? 'Expo ticket reported an error',
        };
      }

      return { ok: true, vendor: this.vendor, vendorRef: ticket.id ?? null };
    } catch (error) {
      return {
        ok: false,
        vendor: this.vendor,
        retryable: !(error instanceof ExpoPermanentError),
        code: error instanceof ExpoPermanentError ? 'bad_request' : 'transport_error',
        message: String(error),
      };
    }
  }

  /**
   * The half of the contract the send path cannot see. Called by
   * `notifications.push-receipts`; returns the receipt per ticket id so the
   * dispatcher can revoke devices whose token Expo now reports as dead.
   */
  async receipts(ticketIds: string[]): Promise<Record<string, ExpoReceipt>> {
    if (ticketIds.length === 0) return {};

    return this.policy.run<Record<string, ExpoReceipt>>(
      { vendor: this.vendor, attempts: 2, backoffMs: 1_000 },
      async (signal) => {
        const response = await fetch(this.env.EXPO_PUSH_RECEIPTS_URL, {
          method: 'POST',
          signal,
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...(this.env.EXPO_ACCESS_TOKEN
              ? { authorization: `Bearer ${this.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({ ids: ticketIds }),
        });

        if (!response.ok) throw new Error(`Expo receipts returned ${response.status}`);
        const body = (await response.json()) as { data?: Record<string, ExpoReceipt> };
        return body.data ?? {};
      },
    );
  }
}

class ExpoPermanentError extends Error {}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}
