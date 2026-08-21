import { Injectable, Logger } from '@nestjs/common';
import type { NotificationChannel } from '@towing/api-contracts';
import type { ChannelPort, ChannelResult, ChannelSendParams } from '../channel.port';

/**
 * The PERMANENT zero-credential delivery path — the same standing as
 * `DevOtpAdapter`, `DevPayoutAdapter` and `DiskStorageAdapter`, and for the
 * same reason: `pnpm backend` + `pnpm db:seed` must demonstrate the entire
 * notification spine with no Firebase project, no MSG91 account, no WhatsApp
 * BSP and no SES production access, forever.
 *
 * IT IS NOT A STUB. Every delivery it handles writes a real
 * `notification_deliveries` row and a real `notifications` inbox row, so the
 * in-app centre, the preference filter, the retry ladder, the DLQ and the
 * §9.4.3 acceptance chain are all exercised on this path. The only thing that
 * does not happen is a packet leaving the machine.
 *
 * It also masks: a live push token or phone number in a log sink is a delivery
 * capability sitting in plaintext, and this adapter is the one that runs in
 * every developer's terminal.
 */
@Injectable()
export abstract class LogChannelAdapter implements ChannelPort {
  readonly vendor = 'log';
  abstract readonly channel: NotificationChannel;

  private readonly logger = new Logger('Notifications');

  /** Test seam: specs assert on what the spine tried to send without a fake adapter. */
  readonly sent: ChannelSendParams[] = [];

  async send(params: ChannelSendParams): Promise<ChannelResult> {
    this.sent.push(params);
    this.logger.log(
      `[log] ${this.channel} → ${maskDestination(params.to)}: ${params.templateKey}` +
        ` priority=${params.priority} ${JSON.stringify(params.variables)}`,
    );
    return { ok: true, vendor: this.vendor, vendorRef: null };
  }

  /** Called between specs — the buffer is per-instance, but the instance is a singleton. */
  clear(): void {
    this.sent.length = 0;
  }
}

@Injectable()
export class LogPushAdapter extends LogChannelAdapter {
  readonly channel = 'push' as const;
}

@Injectable()
export class LogSmsAdapter extends LogChannelAdapter {
  readonly channel = 'sms' as const;
}

@Injectable()
export class LogWhatsAppAdapter extends LogChannelAdapter {
  readonly channel = 'whatsapp' as const;
}

@Injectable()
export class LogEmailAdapter extends LogChannelAdapter {
  readonly channel = 'email' as const;
}

/**
 * Shared by the log adapter and by `notification_deliveries.destination`, which
 * is stored masked at rest for the same reason: that table has no retention
 * purge until Phase 20, and a push token is a live delivery capability rather
 * than an identifier.
 */
export function maskDestination(to: string): string {
  if (to.includes('@')) {
    const at = to.indexOf('@');
    const local = to.slice(0, at);
    const domain = to.slice(at + 1);
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }
  if (to.startsWith('ExponentPushToken') || to.startsWith('ExpoPushToken')) {
    return `${to.slice(0, 18)}…${to.slice(-6)}`;
  }
  // Phone: keep the last 4, which is what a support agent matches against.
  return to.length <= 4 ? '****' : `${'*'.repeat(to.length - 4)}${to.slice(-4)}`;
}
