import { create } from 'zustand';
import { profileMock } from '../mocks/profile.mock';

type ProfileState = {
  name: string;
  phone: string;
  email: string;
  setProfile: (profile: { name: string; phone: string; email: string }) => void;
};

/** User profile (mock now; backed by the auth/user API later). */
export const useProfileStore = create<ProfileState>((set) => ({
  name: profileMock.name,
  phone: profileMock.phone,
  email: profileMock.email,
  setProfile: (profile) => set(profile),
}));
