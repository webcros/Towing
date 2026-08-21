import { randomUUID } from 'expo-crypto';
import { storage } from '@/lib/storage/storage';

const INSTALLATION_KEY = 'push.installationId';

/**
 * A stable id for THIS INSTALL, minted once and kept in MMKV.
 *
 * It is not a device id and not a user id — it identifies the app installation,
 * which is the thing a push token actually belongs to. Without it, every Expo
 * token rotation would look like a brand-new device to the server, which would
 * insert a second `devices` row and start delivering every notification twice.
 *
 * It survives logout on purpose: the same handset signing a different person in
 * must reuse it, so the server can revoke the previous owner's registration
 * instead of leaving two live rows pointed at one lock screen.
 *
 * It does NOT survive a reinstall, which is correct — a reinstall genuinely is
 * a new installation and gets a new token anyway.
 */
export function getInstallationId(): string {
  const existing = storage.getString(INSTALLATION_KEY);
  if (existing) return existing;

  const created = randomUUID();
  storage.set(INSTALLATION_KEY, created);
  return created;
}
