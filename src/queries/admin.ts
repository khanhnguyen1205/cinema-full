import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getBookings,
  createMovie,
  updateMovie,
  deleteMovie,
  createRoom,
  updateRoom,
  deleteRoom,
  createShowtime,
  updateShowtime,
  deleteShowtime,
  updateBooking,
  deleteBooking,
} from "services/api";
import type { Booking, Movie, Room, Showtime } from "types";
import { qk } from "./keys";

type Id = number | string;

// Admin: gateway trả TẤT CẢ bookings cho role admin (khác qk.myBookings).
export const useAllBookings = (): UseQueryResult<Booking[]> =>
  useQuery({ queryKey: qk.allBookings, queryFn: getBookings });

// ---- Movies ----
export const useCreateMovie = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Movie>) => createMovie(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  });
};
export const useUpdateMovie = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: Id; body: Partial<Movie> }) =>
      updateMovie(v.id, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  });
};
export const useDeleteMovie = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => deleteMovie(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  });
};

// ---- Rooms ----
export const useCreateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Room>) => createRoom(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
};
export const useUpdateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: Id; body: Partial<Room> }) =>
      updateRoom(v.id, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
};
export const useDeleteRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => deleteRoom(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
};

// ---- Showtimes (useAllShowtimes dùng key qk.showtimes) ----
export const useCreateShowtime = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Showtime>) => createShowtime(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.showtimes }),
  });
};
export const useUpdateShowtime = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: Id; body: Partial<Showtime> }) =>
      updateShowtime(v.id, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.showtimes }),
  });
};
export const useDeleteShowtime = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => deleteShowtime(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.showtimes }),
  });
};

// ---- Bookings ----
export const useUpdateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: Id; body: Partial<Booking>; showtimeId?: Id }) =>
      updateBooking(v.id, v.body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.allBookings });
      if (v.showtimeId != null)
        qc.invalidateQueries({ queryKey: qk.occupiedSeats(v.showtimeId) });
    },
  });
};
export const useDeleteBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: Id; showtimeId?: Id }) => deleteBooking(v.id),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.allBookings });
      if (v.showtimeId != null)
        qc.invalidateQueries({ queryKey: qk.occupiedSeats(v.showtimeId) });
    },
  });
};
