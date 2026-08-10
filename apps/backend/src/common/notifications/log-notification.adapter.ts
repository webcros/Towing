import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPort, NotifyParams } from './notification.port';

@Injectable()
export class LogNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger('Notifications');

  async notify(params: NotifyParams): Promise<void> {
    this.logger.log(
      `[stub] ${params.channel} → ${params.to}: ${params.template} ${JSON.stringify(params.variables ?? {})}`,
    );
  }
}
