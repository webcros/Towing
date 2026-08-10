import { Module } from '@nestjs/common';
import { MoneyModule } from '../money/money.module';
import { WebhooksController } from './webhooks.controller';

/**
 * No `AuthModule` import, deliberately: nothing here is authenticated by a
 * session. The signature is the authentication.
 */
@Module({
  imports: [MoneyModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
