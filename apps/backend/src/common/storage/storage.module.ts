import { Global, Module } from '@nestjs/common';
import { DiskStorageAdapter } from './disk-storage.adapter';
import { PresignedUploadService } from './presigned-upload.helper';
import { STORAGE } from './storage.port';

/** Global: uploads happen from several modules; the adapter swap is per-env (Phase 9 → S3). */
@Global()
@Module({
  providers: [{ provide: STORAGE, useClass: DiskStorageAdapter }, PresignedUploadService],
  exports: [STORAGE, PresignedUploadService],
})
export class StorageModule {}
