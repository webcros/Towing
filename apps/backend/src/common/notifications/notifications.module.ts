import { Global, Module } from '@nestjs/common';
import { LogNotificationAdapter } from './log-notification.adapter';
import { NOTIFICATIONS } from './notification.port';

@Global()
@Module({
  providers: [{ provide: NOTIFICATIONS, useClass: LogNotificationAdapter }],
  exports: [NOTIFICATIONS],
})
export class NotificationsModule {}
