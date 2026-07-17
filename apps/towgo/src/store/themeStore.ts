import { create } from 'zustand';
import type { ThemePreference } from '@towing/theme';

type ThemeStore = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

/**
 * User's theme choice. Locked to 'light' for now — the Figma is a light design,
 * so the app must not follow a dark-mode device. Switch to 'system' once a dark
 * design exists.
 */
export const useThemeStore = create<ThemeStore>((set) => ({
  preference: 'light',
  setPreference: (preference) => set({ preference }),
}));
