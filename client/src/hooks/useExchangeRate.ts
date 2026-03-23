import { trpc } from "@/lib/trpc";

const FALLBACK_RATE = 93.5;

export function useExchangeRate() {
  const { data } = trpc.system.getExchangeRate.useQuery(undefined, {
    staleTime: 60 * 60 * 1000, // don't refetch within 1 hour
    gcTime: 60 * 60 * 1000,
  });
  return data?.rate ?? FALLBACK_RATE;
}
