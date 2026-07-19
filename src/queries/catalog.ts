import { useQuery } from "@tanstack/react-query";
import {
  getMovies,
  getMovie,
  getCinema,
  getCinemas,
  getCities,
  getAllShowtimes,
  getShowtimes,
  getShowtimesByCinema,
  getRooms,
} from "services/api";
import { qk } from "./keys";

export const useMovies = () =>
  useQuery({ queryKey: qk.movies, queryFn: getMovies });

export const useCinemas = () =>
  useQuery({ queryKey: qk.cinemas, queryFn: () => getCinemas() });

export const useCities = () =>
  useQuery({ queryKey: qk.cities, queryFn: getCities });

export const useAllShowtimes = () =>
  useQuery({ queryKey: qk.showtimes, queryFn: getAllShowtimes });

export const useRooms = () =>
  useQuery({ queryKey: qk.rooms, queryFn: () => getRooms() });

export const useMovie = (id: number | string) =>
  useQuery({ queryKey: qk.movie(id), queryFn: () => getMovie(id) });

export const useShowtimesByMovie = (id: number | string) =>
  useQuery({
    queryKey: qk.showtimesByMovie(id),
    queryFn: () => getShowtimes(id),
  });

export const useCinema = (id: number | string) =>
  useQuery({ queryKey: qk.cinema(id), queryFn: () => getCinema(id) });

export const useShowtimesByCinema = (id: number | string) =>
  useQuery({
    queryKey: qk.showtimesByCinema(id),
    queryFn: () => getShowtimesByCinema(id),
  });
