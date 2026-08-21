import { randomUUID } from 'expo-crypto';
import type { DevicesDataSource } from './devicesDataSource';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The hermetic CI path. Registration is a no-op that succeeds, so the Maestro
 * login flows run without a push token, a Firebase project or a network.
 */
export const devicesMockSource: DevicesDataSource = {
  async register() {
    await delay(150);
    return { id: randomUUID() };
  },

  async unregister() {
    await delay(100);
  },
};
