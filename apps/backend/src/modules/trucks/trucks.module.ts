import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TruckImportsService } from './imports.service';
import { TrucksController } from './trucks.controller';
import { TrucksRepo } from './trucks.repo';
import { TrucksService } from './trucks.service';

@Module({
  imports: [AuthModule],
  controllers: [TrucksController],
  providers: [TrucksService, TrucksRepo, TruckImportsService],
  exports: [TrucksRepo],
})
export class TrucksModule {}
