import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmergencyContactCreate } from '@towing/api-contracts';
import { emergencyContactsDataSource } from './emergencyContactsDataSource';
import { emergencyContactsKeys } from './emergencyContacts.keys';

/** Emergency Contacts list + Add Contact (spec §13 SOS prerequisite). */
export function useEmergencyContacts() {
  return useQuery({
    queryKey: emergencyContactsKeys.list(),
    queryFn: () => emergencyContactsDataSource.list(),
  });
}

export function useCreateEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmergencyContactCreate) => emergencyContactsDataSource.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: emergencyContactsKeys.list() }),
  });
}

export function useDeleteEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => emergencyContactsDataSource.remove(contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: emergencyContactsKeys.list() }),
  });
}
