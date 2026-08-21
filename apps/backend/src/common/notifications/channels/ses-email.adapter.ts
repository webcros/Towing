import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ENV, type Env } from '../../../config/env';
import { ExternalCallPolicy } from '../../http/external-call.policy';
import type { ChannelPort, ChannelResult, ChannelSendParams } from '../channel.port';

/**
 * Amazon SES (§12.1, §12.2's four email-required rows).
 *
 * ⚠ NEVER EXECUTED AGAINST SES. There are no AWS credentials and SES
 * production access is a support-ticket review that has not been raised
 * (`ToBeDoneEhsan.md`). Not one email has been sent by this adapter.
 *
 * WHY `@aws-sdk/client-sesv2` AND NOT A HAND-ROLLED SIGV4 SIGNER. SES's HTTPS
 * API requires SigV4. Hand-writing request-signing crypto for a path that has
 * no credentials and cannot be executed here would ship ~60 lines of security
 * code that passes review as finished and has never once run against the
 * service it signs for — the exact failure mode this repo refuses elsewhere
 * (see `apple-identity.adapter.ts`'s original docstring). The scoped v2 client
 * is one import, stays behind `EMAIL_CHANNEL`, and Phase 9b's S3 adapter and
 * Phase 19's invoice attachment both reuse the same credential chain.
 *
 * The client is constructed LAZILY. The module factory instantiates this class
 * whichever adapter it ends up binding, and an `SESv2Client` built at
 * construction time would resolve the AWS credential chain on every `log` boot
 * — including in CI, where that means an EC2 metadata lookup that hangs.
 */
@Injectable()
export class SesEmailAdapter implements ChannelPort, OnModuleInit {
  readonly vendor = 'ses';
  readonly channel = 'email' as const;

  private readonly logger = new Logger(SesEmailAdapter.name);
  private client: SESv2Client | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly policy: ExternalCallPolicy,
  ) {}

  onModuleInit(): void {
    if (this.env.NOTIFY_EMAIL_PROVIDER !== 'ses') return;
    // `assertProductionSafety` refuses the `.local` placeholder in production.
    if (this.env.SES_FROM_EMAIL.endsWith('.local')) {
      this.logger.warn('NOTIFY_EMAIL_PROVIDER=ses but SES_FROM_EMAIL is still the dev placeholder');
    }
    this.client = new SESv2Client({ region: this.env.SES_REGION });
  }

  async send(params: ChannelSendParams): Promise<ChannelResult> {
    const client = this.client;
    if (!client) {
      return {
        ok: false,
        vendor: this.vendor,
        retryable: false,
        code: 'not_initialised',
        message: 'SES client was never initialised — NOTIFY_EMAIL_PROVIDER is not ses',
      };
    }

    try {
      return await this.policy.run<ChannelResult>(
        {
          vendor: this.vendor,
          attempts: 3,
          backoffMs: 1_000,
          // SES throttling is retryable; a rejected address or an unverified
          // identity is not, and burning three attempts on it only delays the
          // DLQ landing.
          isRetryable: (error) => {
            const name = (error as { name?: string })?.name ?? '';
            return !['MessageRejected', 'MailFromDomainNotVerified', 'AccountSuspendedException']
              .includes(name);
          },
        },
        async () => {
          const result = await client.send(
            new SendEmailCommand({
              FromEmailAddress: this.env.SES_FROM_EMAIL,
              Destination: { ToAddresses: [params.to] },
              Content: {
                Simple: {
                  Subject: { Data: params.rendered.subject ?? params.rendered.title ?? '' },
                  Body: { Text: { Data: params.rendered.body } },
                },
              },
            }),
          );
          return { ok: true, vendor: this.vendor, vendorRef: result.MessageId ?? null };
        },
      );
    } catch (error) {
      const name = (error as { name?: string })?.name ?? 'transport_error';
      return {
        ok: false,
        vendor: this.vendor,
        retryable: !['MessageRejected', 'MailFromDomainNotVerified'].includes(name),
        code: name,
        message: String(error),
      };
    }
  }
}
