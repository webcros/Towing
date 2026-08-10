export type NotificationChannel = 'push' | 'sms' | 'whatsapp' | 'email';

export interface NotifyParams {
  /** E.164 phone or email address depending on channel. */
  to: string;
  channel: NotificationChannel;
  /** Template key (spec §12: DLT-registered templates, content managed in admin). */
  template: string;
  variables?: Record<string, string>;
}

/**
 * Outbound notification seam (spec §12). Real fan-out goes via SQS + provider
 * adapters (MSG91/FCM/SES) later; the log adapter keeps flows honest now.
 */
export interface NotificationPort {
  notify(params: NotifyParams): Promise<void>;
}

export const NOTIFICATIONS = Symbol('NOTIFICATIONS');
