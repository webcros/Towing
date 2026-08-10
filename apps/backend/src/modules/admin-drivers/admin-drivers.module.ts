import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuthModule } from '../auth/auth.module';
import { AdminDriversController } from './admin-drivers.controller';
import { AdminDriversService } from './admin-drivers.service';

/**
 * The §3.1 KYC queue + per-document review (Phase 11). Imports
 * `AdminAuthModule` for its exported `AdminAuditService` — this stays the
 * sole writer of `admin_actions` rather than gaining a second one here.
 */
@Module({
  imports: [AuthModule, AdminAuthModule],
  controllers: [AdminDriversController],
  providers: [AdminDriversService],
})
export class AdminDriversModule {}
