import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env';
import { ExternalCallPolicy } from '../../http/external-call.policy';
import type { ChannelPort, ChannelResult, ChannelSendParams } from '../channel.port';

/**
 * WhatsApp Cloud API (§12.1).
 *
 * ⚠ NEVER EXECUTED AGAINST META. Written against the documented Graph API
 * `/messages` shape and exercised only by fakes — there is no BSP account and
 * no approved template (`ToBeDoneEhsan.md`). Not one message has been sent.
 *
 * TEMPLATE APPROVAL IS THE BLOCKER. Outside a 24-hour customer-initiated
 * window, WhatsApp only permits pre-approved *template* messages referenced by
 * name — free-form text is rejected. Every §12.2 row is business-initiated, so
 * every send here is a template send, and a null `waTemplateName` is a hard
 * "cannot send" rather than a fallback to text.
 *
 * This adapter also exists ahead of its busiest consumer on purpose: Phase 20's
 * SOS fan-out to emergency contacts is WhatsApp + SMS, and that is not the
 * moment to be integrating a new vendor.
 */
@Injectable()
export class CloudWhatsAppAdapter implements ChannelPort, OnModuleInit {
  readonly vendor = 'whatsapp_cloud';
  readonly channel = 'whatsapp' as const;

  private readonly logger = new Logger(CloudWhatsAppAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly policy: ExternalCallPolicy,
  ) {}

  onModuleInit(): void {
    if (this.env.NOTIFY_WHATSAPP_PROVIDER !== 'cloud_api') return;
    if (!this.env.WHATSAPP_PHONE_NUMBER_ID || !this.env.WHATSAPP_ACCESS_TOKEN) {
      this.logger.warn('NOTIFY_WHATSAPP_PROVIDER=cloud_api but WhatsApp credentials are incomplete');
    }
  }

  async send(params: ChannelSendParams): Promise<ChannelResult> {
    if (!params.waTemplateName) {
      return {
        ok: false,
        vendor: this.vendor,
        retryable: false,
        code: 'wa_template_missing',
        message: `No approved WhatsApp template for "${params.templateKey}" — submit it to Meta first`,
      };
    }

    // Cloud API takes body parameters POSITIONALLY ({{1}}, {{2}}…), so the
    // order the catalog declares its variables in is part of the approved
    // template's contract. `orderedVariables` is why the catalog keeps a list
    // rather than relying on object key order.
    const components = [
      {
        type: 'body',
        parameters: Object.values(params.variables).map((text) => ({ type: 'text', text })),
      },
    ];

    try {
      return await this.policy.run<ChannelResult>(
        { vendor: this.vendor, attempts: 3, backoffMs: 1_000 },
        async (signal) => {
          const response = await fetch(
            `${this.env.WHATSAPP_BASE_URL}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
              method: 'POST',
              signal,
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN ?? ''}`,
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: params.to.replace(/^\+/, ''),
                type: 'template',
                template: {
                  name: params.waTemplateName,
                  language: { code: 'en' },
                  components,
                },
              }),
            },
          );

          const text = await response.text();
          if (!response.ok) {
            if (response.status < 500) throw new WhatsAppPermanentError(`${response.status}: ${text}`);
            throw new Error(`WhatsApp returned ${response.status}: ${text}`);
          }

          const body = JSON.parse(text) as { messages?: Array<{ id?: string }> };
          return { ok: true, vendor: this.vendor, vendorRef: body.messages?.[0]?.id ?? null };
        },
      );
    } catch (error) {
      return {
        ok: false,
        vendor: this.vendor,
        retryable: !(error instanceof WhatsAppPermanentError),
        code: error instanceof WhatsAppPermanentError ? 'rejected' : 'transport_error',
        message: String(error),
      };
    }
  }
}

class WhatsAppPermanentError extends Error {}
