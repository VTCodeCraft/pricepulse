import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Scrapes run at most every hour; data older than 30 s is refreshed when a page mounts again.
      staleTime: 30_000,
      retry: 1,
    },
  },
});
