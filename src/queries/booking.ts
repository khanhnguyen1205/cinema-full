import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getOccupiedSeats,
  getConcessions,
  getBookings,
  createBooking,
} from "services/api";
import type { Booking, Concession } from "types";
import { qk } from "./keys";

// Ghế đã chiếm (đặt + người khác đang giữ). poll=true -> tự refetch 10s ở bước chọn ghế.
export const useOccupiedSeats = (
  showtimeId: number | string,
  opts: { poll?: boolean; enabled?: boolean } = {},
): UseQueryResult<string[]> =>
  useQuery({
    queryKey: qk.occupiedSeats(showtimeId),
    queryFn: () => getOccupiedSeats(showtimeId),
    enabled: opts.enabled ?? true,
    refetchInterval: opts.poll ? 10_000 : false,
  });

export const useConcessions = (): UseQueryResult<Concession[]> =>
  useQuery({ queryKey: qk.concessions, queryFn: getConcessions });

// Gateway đã scope GET /bookings theo caller -> đây là "vé của tôi".
export const useMyBookings = (): UseQueryResult<Booking[]> =>
  useQuery({ queryKey: qk.myBookings, queryFn: getBookings });

// Đặt vé: invalidate danh sách vé của tôi + ghế trống của suất vừa đặt.
export const useCreateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (booking: Partial<Booking> & { showtimeId: number }) =>
      createBooking(booking),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.myBookings });
      qc.invalidateQueries({
        queryKey: qk.occupiedSeats(variables.showtimeId),
      });
    },
  });
};
