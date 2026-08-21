import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Navigation from outside the tree.
 *
 * NEEDED BECAUSE AN OFFER IS NOT A TAP. Every other navigation in this app
 * starts inside a screen, where `useNavigation` is available; §6.3's takeover
 * starts with a socket frame or a poll landing in the query cache while the
 * driver is looking at some other tab entirely. The gate that watches for it
 * has to sit above the navigator to be always-mounted, which is exactly where
 * `useNavigation` does not work.
 *
 * `isReady()` before every call: frames can arrive during the first render pass
 * (the socket outlives a screen and the cache is warm), and navigating before
 * the container has mounted is a silent no-op that loses the offer.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
