import { QueryClient } from '@tanstack/react-query';

export const DEFAULT_PAGE_SIZE = 20;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
