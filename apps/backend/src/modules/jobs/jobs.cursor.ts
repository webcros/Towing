import { ApiException } from '../../common/errors/api-exception';

export interface JobsCursor {
  createdAt: Date;
  id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opaque keyset cursor: base64url of `<iso>|<uuid>`, matching the feed sort. */
export function encodeCursor(cursor: JobsCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeCursor(raw: string): JobsCursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separator = decoded.lastIndexOf('|');
  const iso = decoded.slice(0, separator);
  const id = decoded.slice(separator + 1);

  const createdAt = new Date(iso);
  if (separator === -1 || Number.isNaN(createdAt.getTime()) || !UUID_RE.test(id)) {
    throw ApiException.validation('Invalid pagination cursor');
  }
  return { createdAt, id };
}
