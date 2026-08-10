import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileDataSource } from './profileDataSource';
import { profileKeys } from './profile.keys';

/** Profile screen + Personal Information (spec §9.1.3). */
export function useProfile() {
  return useQuery({
    queryKey: profileKeys.detail(),
    queryFn: () => profileDataSource.getProfile(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof profileDataSource.updateProfile>[0]) =>
      profileDataSource.updateProfile(patch),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.detail(), profile);
    },
  });
}
