import { useQuery } from "@tanstack/react-query";
import {
  getMovies,
  getCinemas,
  getCities,
  getAllShowtimes,
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
