import { useQuery } from '@tanstack/react-query';
import { offersDataSource } from './offersDataSource';
import { offersKeys } from './offers.keys';

/** The current incoming tow request, if any (Figma driver "New Job"). */
export function useCurrentOffer() {
  return useQuery({
    queryKey: offersKeys.current(),
    queryFn: () => offersDataSource.getCurrentOffer(),
  });
}
