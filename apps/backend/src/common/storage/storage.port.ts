export interface StoredFile {
  /** Opaque URL recorded in the database (`local://…` now, `s3://…` later). */
  fileUrl: string;
}

export interface PutFileParams {
  buffer: Buffer;
  mimeType: string;
  /** Logical folder, e.g. `compliance/<truckId>`. */
  keyPrefix: string;
  originalName?: string;
}

export interface PresignedUrl {
  url: string;
  /** The key the caller should record — same shape as `StoredFile.fileUrl`'s key half. */
  key: string;
  expiresAt: string;
}

/**
 * Blob storage seam. The disk adapter serves local dev; the S3 adapter
 * (SSE-KMS, pre-signed GETs — Phase 9) drops in behind the same token and the
 * intent that files are private-by-default travels with the interface.
 *
 * `presignPut`/`presignGet` (Phase 11, §3.1) let a caller hand a client a
 * time-limited URL instead of proxying bytes through the API — on S3 this is a
 * real presigned request; the disk adapter signs a URL against its own
 * `GET/PUT /v1/files/:key` routes (`modules/files`) so local dev has the same
 * two-call shape.
 */
export interface StoragePort {
  put(params: PutFileParams): Promise<StoredFile>;
  /** `key` is caller-chosen (e.g. `driver-documents/<driverId>/<uuid>.jpg`) — the caller owns naming because the bytes don't exist yet to derive one from. */
  presignPut(key: string, ttlSeconds: number, contentType?: string): Promise<PresignedUrl>;
  presignGet(key: string, ttlSeconds: number): Promise<PresignedUrl>;
}

export const STORAGE = Symbol('STORAGE');
