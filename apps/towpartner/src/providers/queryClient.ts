import { QueryClient } from '@tanstack/react-query';

/**
 * Shared Query client. Cache-first defaults (spec §10.8): short staleTime for
 * live-ish data (job offers refresh quickly), long gcTime so cached content
 * paints instantly on re-open. (MMKV persistence can be layered on later.)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
