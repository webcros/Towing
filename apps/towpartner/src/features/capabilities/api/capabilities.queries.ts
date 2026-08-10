import { useMutation } from '@tanstack/react-query';
import { capabilitiesDataSource } from './capabilitiesDataSource';

/**
 * No `GET /driver/capabilities` exists yet — Phase 11 shipped the write side
 * only (see `driver-kyc.controller.ts`) — so there is nothing to seed the
 * screen from on open; it starts blank and shows whatever the driver last
 * saved *this session* via the mutation's own response. Flagged in
 * ToBeDoneEhsan.md rather than invented here.
 */
export function useUpdateCapabilities() {
  return useMutation({
    mutationFn: capabilitiesDataSource.update,
  });
}
