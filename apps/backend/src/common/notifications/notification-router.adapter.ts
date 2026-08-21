import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { MetricsService } from '../observability/metrics.service';
import {
  EMAIL_CHANNEL,
  PUSH_CHANNEL,
  SMS_CHANNEL,
  WHATSAPP_CHANNEL,
  type ChannelPort,
  type ChannelResult,
  type ChannelSendParams,
} from './channel.port';
import type { NotificationChannel, NotificationPort } from './notification.port';

/**
 * The single `NotificationPort` binding: routes one send to the port for its
 * channel and records the outcome.
 *
 * It is thin on purpose. Retry ladders live in `ExternalCallPolicy` (per call)
 * and BullMQ (per job); preference filtering lives in the fan-out worker;
 * rendering lives in the template catalog. This class only decides *which
 * adapter* — which is the one decision that has to be made per send rather than
 * per job or per vendor.
 */
@Injectable()
export class NotificationRouterAdapter implements NotificationPort, OnApplicationBootstrap {
  private readonly logger = new Logger('Notifications');

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly metrics: MetricsService,
    @Inject(PUSH_CHANNEL) private readonly push: ChannelPort,
    @Inject(SMS_CHANNEL) private readonly sms: ChannelPort,
    @Inject(WHATSAPP_CHANNEL) private readonly whatsapp: ChannelPort,
    @Inject(EMAIL_CHANNEL) private readonly email: ChannelPort,
  ) {}

  /**
   * The startup WARN that `assertProductionSafety` deliberately does not throw.
   *
   * Refusing to boot production on a `log` channel would turn the WhatsApp BSP
   * approval and the SES production-access review — both multi-week external
   * processes — into hard launch blockers, which is the opposite of this repo's
   * dev-safe-default rule. But shipping to production with a channel silently
   * logging instead of delivering is exactly the kind of thing that goes
   * unnoticed for a month, so it says so, loudly, once, at boot.
   */
  onApplicationBootstrap(): void {
    const logging = [
      ['push', this.env.NOTIFY_PUSH_PROVIDER],
      ['sms', this.env.NOTIFY_SMS_PROVIDER],
      ['whatsapp', this.env.NOTIFY_WHATSAPP_PROVIDER],
      ['email', this.env.NOTIFY_EMAIL_PROVIDER],
    ]
      .filter(([, provider]) => provider === 'log')
      .map(([channel]) => channel);

    if (!this.env.NOTIFY_ENABLED) {
      this.logger.warn(
        'NOTIFY_ENABLED=false — events and in-app notifications are recorded, nothing is delivered',
      );
    }

    if (logging.length === 0) return;

    const message = `notification channels on the log adapter (nothing is delivered): ${logging.join(', ')}`;
    if (this.env.NODE_ENV === 'production') this.logger.error(message);
    else this.logger.log(message);
  }

  async notify(channel: NotificationChannel, params: ChannelSendParams): Promise<ChannelResult> {
    const port = this.portFor(channel);
    const result = await port.send(params);

    this.metrics.observeNotificationSend(channel, port.vendor, result.ok ? 'sent' : 'failed');
    if (!result.ok) {
      this.logger.warn(
        `${channel} via ${port.vendor} failed for delivery ${params.deliveryId}:` +
          ` ${result.code} — ${result.message}`,
      );
    }
    return result;
  }

  private portFor(channel: NotificationChannel): ChannelPort {
    switch (channel) {
      case 'push':
        return this.push;
      case 'sms':
        return this.sms;
      case 'whatsapp':
        return this.whatsapp;
      case 'email':
        return this.email;
    }
  }
}
