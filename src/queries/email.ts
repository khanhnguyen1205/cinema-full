import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getEmailConfig,
  resendTicketEmail,
  type EmailConfig,
} from "services/email";
import { qk } from "./keys";

// Cấu hình email không đổi trong một phiên -> không cần refetch.
export const useEmailConfig = (): UseQueryResult<EmailConfig> =>
  useQuery({
    queryKey: qk.emailConfig,
    queryFn: getEmailConfig,
    staleTime: Infinity,
  });

export const useResendTicket = (): UseMutationResult<void, Error, number> =>
  useMutation({
    mutationFn: (bookingId: number) => resendTicketEmail(bookingId),
  });
