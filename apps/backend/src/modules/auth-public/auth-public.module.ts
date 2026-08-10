import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OtpRateService } from '../auth/otp-rate.service';
import { AuthPublicController } from './auth-public.controller';
import { AuthPublicService } from './auth-public.service';
import { AppleIdentityAdapter } from './social/apple-identity.adapter';
import { GoogleIdentityAdapter } from './social/google-identity.adapter';
import { SOCIAL_IDENTITY_PORTS, type SocialIdentityPort } from './social/social-identity.port';
import { SocialIdentityRegistry } from './social/social-identity.registry';
import { SubjectRepo } from './subject.repo';

/**
 * The customer and driver auth realms (§15.2). `AuthModule` supplies the shared
 * machinery — `TokenService`, the realm policies, `OtpPort`, `JwtModule`.
 *
 * Both social adapters are registered whether or not they are usable;
 * `SocialIdentityRegistry` is the single place that turns "not configured" into
 * a refusal, so adding a provider cannot accidentally skip that check.
 */
@Module({
  imports: [AuthModule],
  controllers: [AuthPublicController],
  providers: [
    AuthPublicService,
    SubjectRepo,
    OtpRateService,
    GoogleIdentityAdapter,
    AppleIdentityAdapter,
    {
      provide: SOCIAL_IDENTITY_PORTS,
      inject: [GoogleIdentityAdapter, AppleIdentityAdapter],
      useFactory: (google: GoogleIdentityAdapter, apple: AppleIdentityAdapter) =>
        [google, apple] satisfies SocialIdentityPort[],
    },
    SocialIdentityRegistry,
  ],
  exports: [AuthPublicService, SubjectRepo],
})
export class AuthPublicModule {}
