import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { STORAGE, type StoragePort } from './storage.port';

const PRESIGNED_KEY_SUFFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;
const DEFAULT_PRESIGN_TTL_SECONDS = 15 * 60;

export interface PresignedUploadSlot {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

/**
 * Presign-then-confirm document uploads. Generalized out of Phase 11's
 * `driver-kyc.service.ts` (`modules/me`'s profile-photo/vehicle-RC uploads are
 * the second consumer, which is what made the extraction worth it — a third,
 * a driver's own profile photo, is plausible later).
 *
 * A key is always `<keyPrefix>/<subjectId>/<docType>-<uuid>.jpg`. Confirming a
 * key checks it is EXACTLY that shape for the calling subject and doc type —
 * see `isOwnKey`'s doc comment for why a bare prefix match is not enough.
 */
@Injectable()
export class PresignedUploadService {
  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  async presign(
    keyPrefix: string,
    subjectId: string,
    docType: string,
    ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS,
  ): Promise<PresignedUploadSlot> {
    // Server-minted, namespaced under the subject's own id — `isOwnKey` below
    // trusts a key back from the client only because it can check the exact
    // shape minted here, not because the client is assumed honest.
    const key = `${keyPrefix}/${subjectId}/${docType}-${randomUUID()}.jpg`;
    const presigned = await this.storage.presignPut(key, ttlSeconds);
    return { uploadUrl: presigned.url, key: presigned.key, expiresAt: presigned.expiresAt };
  }

  /**
   * A key from someone ELSE's presign response would still carry a valid
   * signature (signatures don't encode who asked for them) — this is the
   * check that stops a subject claiming another subject's uploaded file as
   * their own by replaying its key.
   *
   * A `randomUUID()`-suffixed `.jpg`, and NOTHING else — no `/`, no `.`, no
   * `..`. Deliberately stricter than "does it start with the right prefix":
   * `"<prefix>/<id>/selfie-".startsWith` would also accept
   * `"<prefix>/<id>/selfie-../../other/doc-<uuid>.jpg"`, since a traversal
   * segment can sit anywhere AFTER a prefix match and `startsWith` never
   * looks past it. Anchoring the suffix to this exact shape closes that off
   * (found by an adversarial security review during Phase 11, see that
   * phase's "what shipped" record for the failure this once was).
   */
  isOwnKey(key: string, keyPrefix: string, subjectId: string, docType: string): boolean {
    const prefix = `${keyPrefix}/${subjectId}/${docType}-`;
    return key.startsWith(prefix) && PRESIGNED_KEY_SUFFIX.test(key.slice(prefix.length));
  }
}
