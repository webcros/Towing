const LOCAL_SCHEME = 'local://';

/**
 * Extracts the storage key from a `local://<key>` URL — the shape every
 * `fileUrl` column has held since `StoragePort.put()` existed. Nothing parsed
 * this before Phase 11, because nothing served a file back over HTTP; the
 * admin document-review queue is the first reader.
 */
export function keyFromFileUrl(fileUrl: string): string {
  if (!fileUrl.startsWith(LOCAL_SCHEME)) {
    throw new Error(`Unsupported file URL scheme: ${fileUrl}`);
  }
  return fileUrl.slice(LOCAL_SCHEME.length);
}
