import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedAddressCreate, SavedAddressUpdate } from '@towing/api-contracts';
import { addressesDataSource } from './addressesDataSource';
import { addressesKeys } from './addresses.keys';

/** Saved Locations list + Add/Edit Location (spec §9.1.11). */
export function useAddresses() {
  return useQuery({
    queryKey: addressesKeys.list(),
    queryFn: () => addressesDataSource.list(),
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedAddressCreate) => addressesDataSource.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addressesKeys.list() }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ addressId, patch }: { addressId: string; patch: SavedAddressUpdate }) =>
      addressesDataSource.update(addressId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addressesKeys.list() }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => addressesDataSource.remove(addressId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addressesKeys.list() }),
  });
}
