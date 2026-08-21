import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import {
  EMAIL_CHANNEL,
  PUSH_CHANNEL,
  SMS_CHANNEL,
  WHATSAPP_CHANNEL,
  type ChannelPort,
} from './channel.port';
import { CloudWhatsAppAdapter } from './channels/cloud-whatsapp.adapter';
import { ExpoPushAdapter } from './channels/expo-push.adapter';
import {
  LogEmailAdapter,
  LogPushAdapter,
  LogSmsAdapter,
  LogWhatsAppAdapter,
} from './channels/log-channel.adapter';
import { Msg91SmsAdapter } from './channels/msg91-sms.adapter';
import { SesEmailAdapter } from './channels/ses-email.adapter';
import { DeviceRegistryService } from './device-registry.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationRouterAdapter } from './notification-router.adapter';
import { NotificationService } from './notification.service';
import { NOTIFICATIONS } from './notification.port';
import { PreferenceService } from './preference.service';
import { RecipientResolverService } from './recipient-resolver.service';

/**
 * `@Global()` because every phase from 15 onwards emits from its own module,
 * and an import edge per producer buys nothing — the same reasoning
 * `StorageModule` and `QueueModule` already carry.
 *
 * FOUR FACTORIES, ONE PER CHANNEL — copying `money.module.ts`'s
 * `PAYOUT_PROVIDER` idiom exactly, including its two consequences:
 *
 *  1. BOTH adapters for a channel are instantiated whichever one the factory
 *     picks, which is precisely why no adapter constructor may validate
 *     credentials or open a connection. Each real adapter does that in
 *     `onModuleInit`, guarded on its own env var.
 *  2. The log adapters are exported BY CLASS alongside their tokens — the
 *     `DevPayoutAdapter` pattern — so specs can read `.sent` off the concrete
 *     adapter without widening `ChannelPort` with a test-only method.
 *
 * `ExternalCallPolicy` USED TO BE PROVIDED HERE. Phase 14 moved it to its own
 * `@Global()` `ExternalCallModule` under `common/http`, because the routing
 * adapters need it too and depending on this module's globality to get it was
 * an undeclared edge. The channel adapters inject it exactly as before.
 */
@Global()
@Module({
  providers: [
    NotificationService,
    NotificationDispatcherService,
    RecipientResolverService,
    PreferenceService,
    DeviceRegistryService,

    LogPushAdapter,
    ExpoPushAdapter,
    LogSmsAdapter,
    Msg91SmsAdapter,
    LogWhatsAppAdapter,
    CloudWhatsAppAdapter,
    LogEmailAdapter,
    SesEmailAdapter,

    {
      provide: PUSH_CHANNEL,
      inject: [ENV, LogPushAdapter, ExpoPushAdapter],
      useFactory: (env: Env, log: LogPushAdapter, expo: ExpoPushAdapter): ChannelPort =>
        env.NOTIFY_PUSH_PROVIDER === 'expo' ? expo : log,
    },
    {
      provide: SMS_CHANNEL,
      inject: [ENV, LogSmsAdapter, Msg91SmsAdapter],
      useFactory: (env: Env, log: LogSmsAdapter, msg91: Msg91SmsAdapter): ChannelPort =>
        env.NOTIFY_SMS_PROVIDER === 'msg91' ? msg91 : log,
    },
    {
      provide: WHATSAPP_CHANNEL,
      inject: [ENV, LogWhatsAppAdapter, CloudWhatsAppAdapter],
      useFactory: (env: Env, log: LogWhatsAppAdapter, cloud: CloudWhatsAppAdapter): ChannelPort =>
        env.NOTIFY_WHATSAPP_PROVIDER === 'cloud_api' ? cloud : log,
    },
    {
      provide: EMAIL_CHANNEL,
      inject: [ENV, LogEmailAdapter, SesEmailAdapter],
      useFactory: (env: Env, log: LogEmailAdapter, ses: SesEmailAdapter): ChannelPort =>
        env.NOTIFY_EMAIL_PROVIDER === 'ses' ? ses : log,
    },

    NotificationRouterAdapter,
    { provide: NOTIFICATIONS, useExisting: NotificationRouterAdapter },
  ],
  exports: [
    NOTIFICATIONS,
    NotificationService,
    NotificationDispatcherService,
    DeviceRegistryService,
    PUSH_CHANNEL,
    SMS_CHANNEL,
    WHATSAPP_CHANNEL,
    EMAIL_CHANNEL,
    LogPushAdapter,
    LogSmsAdapter,
    LogWhatsAppAdapter,
    LogEmailAdapter,
    ExpoPushAdapter,
  ],
})
export class NotificationsModule {}
