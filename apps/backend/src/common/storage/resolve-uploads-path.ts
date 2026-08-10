import { resolve, sep } from 'node:path';

/**
 * Resolves `key` against `root` and rejects anything that escapes it.
 *
 * A valid HMAC over `key` proves the key wasn't tampered with in transit — it
 * says nothing about whether the key itself is a safe filesystem path. Nothing
 * upstream currently mints a key containing `..`, but this is the backstop
 * regardless of that, which is what `files.controller.e2e.spec.ts`'s
 * traversal-key test exercises.
 */
export function resolveUploadsPath(root: string, key: string): string {
  const normalizedRoot = resolve(root) + sep;
  const resolved = resolve(root, key);
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`Refusing to resolve key outside uploads root: ${key}`);
  }
  return resolved;
}
