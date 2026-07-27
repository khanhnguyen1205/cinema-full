import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getPaymentConfig, type PaymentConfig } from "services/payments";
import { qk } from "./keys";

// Cấu hình thanh toán không đổi trong một phiên -> không cần refetch.
export const usePaymentConfig = (): UseQueryResult<PaymentConfig> =>
  useQuery({
    queryKey: qk.paymentConfig,
    queryFn: getPaymentConfig,
    staleTime: Infinity,
  });
