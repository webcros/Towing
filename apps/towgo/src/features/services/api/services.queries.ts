import { useQuery } from '@tanstack/react-query';
import { servicesDataSource } from './servicesDataSource';
import { servicesKeys } from './services.keys';

/**
 * The Appendix B catalogue (§9.1.4's bottom sheet, §9.1.5 step 1).
 *
 * A long `staleTime`: the catalogue changes when a human edits it in admin, not
 * between two taps of the same booking flow.
 */
export function useServices() {
  return useQuery({
    queryKey: servicesKeys.catalog(),
    queryFn: () => servicesDataSource.list(),
    staleTime: 5 * 60 * 1000,
  });
}
