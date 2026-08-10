import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriverKycController } from './driver-kyc.controller';
import { DriverKycService } from './driver-kyc.service';

/** Driver-facing KYC submission (Phase 11, §3.1 layer 1). */
@Module({
  imports: [AuthModule],
  controllers: [DriverKycController],
  providers: [DriverKycService],
})
export class DriverKycModule {}
