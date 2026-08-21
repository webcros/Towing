import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  cursorQuerySchema,
  deviceRegisterSchema,
  deviceUnregisterSchema,
  notificationsReadRequestSchema,
  subjectNotificationPrefsUpdateSchema,
  type CursorQuery,
  type DeviceRegisterRequest,
  type DeviceUnregisterRequest,
  type NotificationsReadRequest,
  type SubjectNotificationPrefsUpdate,
} from '@towing/api-contracts';
import { DeviceRegistryService } from '../../common/notifications/device-registry.service';
import { ThrottleBucket } from '../../common/throttling/throttler.config';
import { ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import type { AuthedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Realms } from '../auth/realm.decorator';
import { customerId } from '../me/me.controller';
import { NotificationCentreService } from './notification-centre.service';

/**
 * The customer half of the notification centre (§12, Phase 13).
 *
 * Mounted at `/me` alongside `MeController` and `AccountPrivacyController` —
 * the same path-prefix split Phase 11 established with `admin-auth` and
 * `admin-drivers`. No route collides; the method+path pairs are distinct.
 *
 * The subject id always comes from `request.auth.sub`, never a path param.
 * These are "my own devices" and "my own notifications" routes, and a path
 * param would be an authorisation decision waiting to be got wrong.
 *
 * Note the `subjectType` mapping: the customer REALM is called `customer`
 * (`@Realms('customer')`, from the JWT), but the polymorphic subject column
 * spelling is `'user'` — matching `login_challenges`, `social_identities`,
 * `consent_records` and `deletion_requests`, and matching `devices` since
 * migration 0010 normalised it.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
@Realms('customer')
export class MeNotificationsController {
  constructor(
    private readonly centre: NotificationCentreService,
    private readonly devices: DeviceRegistryService,
  ) {}

  /**
   * Idempotent upsert — the client calls it on every login and on every push
   * token rotation, so it must be cheap to repeat. Throttled because it is
   * unauthenticated-adjacent in shape (a valid session plus an attacker-chosen
   * token) and writes a row.
   */
  @Post('devices')
  @ThrottleBucket('money')
  registerDevice(
    @ZodBody(deviceRegisterSchema) body: DeviceRegisterRequest,
    @Req() request: AuthedRequest,
  ) {
    return this.devices.register('user', customerId(request), body);
  }

  /**
   * Body-carrying DELETE, matching `DELETE /v1/me`'s existing shape. A path
   * param would put the installation id into every access log for no gain.
   */
  @Delete('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregisterDevice(
    @Body() rawBody: unknown,
    @Req() request: AuthedRequest,
  ): Promise<void> {
    const body = deviceUnregisterSchema.parse(rawBody) as DeviceUnregisterRequest;
    await this.devices.unregister('user', customerId(request), body.installationId);
  }

  @Get('notifications')
  list(@ZodQuery(cursorQuerySchema) query: CursorQuery, @Req() request: AuthedRequest) {
    return this.centre.list('user', customerId(request), query);
  }

  @Get('notifications/unread-count')
  async unreadCount(@Req() request: AuthedRequest) {
    return { unread: await this.centre.unreadCount('user', customerId(request)) };
  }

  /** `ids` absent marks everything read — see the service. */
  @Post('notifications/read')
  markRead(
    @ZodBody(notificationsReadRequestSchema) body: NotificationsReadRequest,
    @Req() request: AuthedRequest,
  ) {
    return this.centre.markRead('user', customerId(request), body.ids);
  }

  @Get('notification-prefs')
  getPrefs(@Req() request: AuthedRequest) {
    return this.centre.getPrefs('user', customerId(request));
  }

  @Put('notification-prefs')
  updatePrefs(
    @ZodBody(subjectNotificationPrefsUpdateSchema) body: SubjectNotificationPrefsUpdate,
    @Req() request: AuthedRequest,
  ) {
    return this.centre.updatePrefs('user', customerId(request), body);
  }
}
