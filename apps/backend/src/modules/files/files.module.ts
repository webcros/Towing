import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';

/** Signed file GET/PUT (Phase 11, §3.1) — see `files.controller.ts`. */
@Module({
  controllers: [FilesController],
})
export class FilesModule {}
