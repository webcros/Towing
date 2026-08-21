import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env';
import { ExternalCallPolicy } from '../../http/external-call.policy';
import type { ChannelPort, ChannelResult, ChannelSendParams } from '../channel.port';

/**
 * MSG91 SMS (§12.1).
 *
 * ⚠ NEVER EXECUTED AGAINST MSG91. Written against the documented Flow API
 * (`/api/v5/flow`) and exercised only by fakes — there is no MSG91 account
 * (`ToBeDoneEhsan.md`). Not one SMS has been sent by this adapter.
 *
 * DLT IS THE REAL BLOCKER, NOT THE HTTP CALL. Indian regulation requires every
 * transactional template to be registered on a DLT platform and referenced by
 * id; MSG91 rejects a send whose `template_id` is unregistered. So
 * `dltTemplateId` being null is a hard "cannot send", not a soft default — the
 * adapter refuses rather than calling and getting a 4xx, which keeps the reason
 * legible in `notification_deliveries.last_error`.
 *
 * OTP DOES NOT COME THROUGH HERE. Login OTP stays on `OtpPort` — routing it
 * through the notification spine would write the live plaintext code into
 * `notification_events.payload`, a table with no TTL and no purge until Phase
 * 20, reversing the hash-at-rest posture `login_challenges.code_hash` has. When
 * MSG91 is contracted, `OtpPort` gets its own adapter sharing this vendor
 * client; the §12.2 OTP row is registered as `deliveredBy: 'otp_port'` so the
 * completeness test still accounts for it.
 */
@Injectable()
export class Msg91SmsAdapter implements ChannelPort, OnModuleInit {
  readonly vendor = 'msg91';
  readonly channel = 'sms' as const;

  private readonly logger = new Logger(Msg91SmsAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly policy: ExternalCallPolicy,
  ) {}

  onModuleInit(): void {
    if (this.env.NOTIFY_SMS_PROVIDER !== 'msg91') return;
    // `assertProductionSafety` already refuses this combination in production;
    // in dev it is a warning so a half-configured .env is obvious immediately
    // rather than at the first send.
    if (!this.env.MSG91_AUTH_KEY || !this.env.MSG91_SENDER_ID) {
      this.logger.warn('NOTIFY_SMS_PROVIDER=msg91 but MSG91 credentials are incomplete');
    }
  }

  async send(params: ChannelSendParams): Promise<ChannelResult> {
    if (!params.dltTemplateId) {
      return {
        ok: false,
        vendor: this.vendor,
        retryable: false,
        code: 'dlt_template_missing',
        message: `No DLT-registered template id for "${params.templateKey}" — register it with MSG91 first`,
      };
    }

    try {
      return await this.policy.run<ChannelResult>(
        { vendor: this.vendor, attempts: 3, backoffMs: 1_000 },
        async (signal) => {
          const response = await fetch(`${this.env.MSG91_BASE_URL}/api/v5/flow`, {
            method: 'POST',
            signal,
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
              authkey: this.env.MSG91_AUTH_KEY ?? '',
            },
            body: JSON.stringify({
              template_id: params.dltTemplateId,
              sender: this.env.MSG91_SENDER_ID,
              short_url: '0',
              recipients: [{ mobiles: toMsg91Mobile(params.to), ...params.variables }],
            }),
          });

          const text = await response.text();
          if (!response.ok) {
            // 4xx is a bad request — a bad template id or an unreachable number
            // will be just as bad next time, and retrying it only delays the
            // DLQ landing that would tell somebody.
            const retryable = response.status >= 500;
            if (!retryable) throw new Msg91PermanentError(`${response.status}: ${text}`);
            throw new Error(`MSG91 returned ${response.status}: ${text}`);
          }

          const body = JSON.parse(text) as { type?: string; message?: string; request_id?: string };
          if (body.type === 'error') {
            throw new Msg91PermanentError(body.message ?? 'MSG91 reported an error');
          }
          return { ok: true, vendor: this.vendor, vendorRef: body.request_id ?? null };
        },
      );
    } catch (error) {
      return {
        ok: false,
        vendor: this.vendor,
        retryable: !(error instanceof Msg91PermanentError),
        code: error instanceof Msg91PermanentError ? 'rejected' : 'transport_error',
        message: String(error),
      };
    }
  }
}

class Msg91PermanentError extends Error {}

/**
 * MSG91 wants a bare country-code-prefixed number, not E.164's leading `+`.
 * Everything upstream stores and resolves E.164, so the translation lives here
 * rather than leaking a vendor's formatting into the resolvers.
 */
function toMsg91Mobile(e164: string): string {
  return e164.replace(/^\+/, '');
}
