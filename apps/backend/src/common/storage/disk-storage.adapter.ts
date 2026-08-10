import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { signFileUrl } from './file-signing';
import type { PresignedUrl, PutFileParams, StoragePort, StoredFile } from './storage.port';

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class DiskStorageAdapter implements StoragePort {
  private readonly root: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.root = resolve(env.UPLOADS_DIR);
  }

  async put(params: PutFileParams): Promise<StoredFile> {
    // The key is server-minted — original names never touch the filesystem,
    // which removes traversal and collision concerns in one move.
    const ext = EXT_BY_MIME[params.mimeType] ?? extname(params.originalName ?? '') ?? '';
    const key = `${params.keyPrefix}/${randomUUID()}${ext}`;

    const path = join(this.root, key);
    await mkdir(join(this.root, params.keyPrefix), { recursive: true });
    await writeFile(path, params.buffer);

    return { fileUrl: `local://${key}` };
  }

  /**
   * On S3 this would be a real presigned PUT the client uploads straight to,
   * bypassing the API entirely. Locally there is no S3 to bypass to, so the
   * signed URL points back at this same process's `PUT /v1/files/:key`
   * (`modules/files`), which writes under `UPLOADS_DIR` exactly like `put()`
   * does — the two-call shape (get a URL, then PUT bytes to it) is what the
   * interface promises callers, even though the disk implementation's "remote"
   * endpoint is itself.
   */
  async presignPut(key: string, ttlSeconds: number): Promise<PresignedUrl> {
    const { sig, exp } = signFileUrl(this.env.FILE_SIGNING_SECRET, 'PUT', key, ttlSeconds);
    return {
      url: `${this.env.PUBLIC_API_URL}/v1/files/${key}?exp=${exp}&sig=${sig}`,
      key,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async presignGet(key: string, ttlSeconds: number): Promise<PresignedUrl> {
    const { sig, exp } = signFileUrl(this.env.FILE_SIGNING_SECRET, 'GET', key, ttlSeconds);
    return {
      url: `${this.env.PUBLIC_API_URL}/v1/files/${key}?exp=${exp}&sig=${sig}`,
      key,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }
}
