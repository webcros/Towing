import { useQuery } from '@tanstack/react-query';
import { profileDataSource } from './profileDataSource';
import { profileKeys } from './profile.keys';

/** The signed-in driver's profile (Figma driver "Profile"). */
export function useDriverProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => profileDataSource.getProfile(),
  });
}
