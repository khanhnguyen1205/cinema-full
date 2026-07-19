import { QueryClient } from "@tanstack/react-query";

// Catalog ít đổi trong một phiên → staleTime 60s, không refetch khi focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
