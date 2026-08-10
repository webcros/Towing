import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsController } from './jobs.controller';
import { JobsRepo } from './jobs.repo';
import { JobsService } from './jobs.service';

@Module({
  imports: [AuthModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRepo],
})
export class JobsModule {}
