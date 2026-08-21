import { Global, Module } from '@nestjs/common';
import { ExternalCallPolicy } from './external-call.policy';

/**
 * `ExternalCallPolicy`'s own module (Phase 14).
 *
 * WHY IT MOVED. Phase 13 built the policy and registered it inside
 * `NotificationsModule`, which is `@Global()` — so injecting it anywhere worked,
 * and nothing said out loud that a routing adapter depended on the notification
 * module being loaded at all. The moment Phase 14 added the second consumer
 * family (`RoutingPort`) that became a real edge: `common/routing` would have
 * been importing `common/notifications` by accident, and dropping the
 * `@Global()` off notifications one day would have broken pricing.
 *
 * §19.3's wrapper serves every outbound vendor call in the system — Maps here,
 * MSG91/FCM/WhatsApp/SES in Phase 13, Razorpay in 19. It belongs to none of them.
 *
 * `@Global()` for the same reason `StorageModule` and `QueueModule` are: the
 * consumer list only grows, and an import edge per vendor adapter buys nothing.
 */
@Global()
@Module({
  providers: [ExternalCallPolicy],
  exports: [ExternalCallPolicy],
})
export class ExternalCallModule {}
