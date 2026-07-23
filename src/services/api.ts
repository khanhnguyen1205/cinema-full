// Data qua cong co phan quyen o API server (:4000/api) — server truy van Postgres qua Prisma.
// credentials:"include" de gui cookie phien -> gateway biet user/role.
import type {
  Booking,
  Cinema,
  City,
  Concession,
  Movie,
  Room,
  Showtime,
} from "types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

type Id = number | string;

const req = (path: string, opts: RequestInit = {}): Promise<Response> =>
  fetch(`${BASE_URL}${path}`, { credentials: "include", ...opts });
const get = <T>(path: string): Promise<T> =>
  req(path).then((r) => r.json() as Promise<T>);

export const getMovies = () => get<Movie[]>(`/movies`);
export const getMovie = (id: Id) => get<Movie>(`/movies/${id}`);

export const getShowtimes = (movieId: Id) =>
  get<Showtime[]>(`/showtimes?movieId=${movieId}`);
export const getShowtime = (id: Id) => get<Showtime>(`/showtimes/${id}`);
export const getAllShowtimes = () => get<Showtime[]>(`/showtimes`);
export const getShowtimesByRoom = (roomId: Id) =>
  get<Showtime[]>(`/showtimes?roomId=${roomId}`);

export const getCities = () => get<City[]>(`/cities`);
export const getCinemas = (cityId?: Id) =>
  get<Cinema[]>(`/cinemas${cityId ? `?cityId=${cityId}` : ""}`);
export const getCinema = (id: Id) => get<Cinema>(`/cinemas/${id}`);
export const getRooms = (cinemaId?: Id) =>
  get<Room[]>(`/rooms${cinemaId ? `?cinemaId=${cinemaId}` : ""}`);
export const getRoom = (id: Id) => get<Room>(`/rooms/${id}`);

// Suất chiếu của 1 rạp: lấy các phòng của rạp rồi gom showtimes theo roomId
export const getShowtimesByCinema = async (
  cinemaId: Id,
): Promise<Showtime[]> => {
  const rooms = await getRooms(cinemaId);
  const lists = await Promise.all(rooms.map((r) => getShowtimesByRoom(r.id)));
  return lists.flat();
};

// Ghế đã đặt của 1 suất (chỉ số ghế, không kèm thông tin cá nhân) — dùng cho sơ đồ ghế.
export const getOccupiedSeats = (showtimeId: Id): Promise<string[]> =>
  get<{ seats?: string[] }>(`/occupied-seats?showtimeId=${showtimeId}`).then(
    (d) => d.seats || [],
  );

// Giữ ghế phía server: gửi toàn bộ ghế đang chọn (đặt lại + gia hạn TTL, kiêm heartbeat).
// Trả nguyên Response để nơi gọi đọc status (409 = ghế vừa bị người khác giữ).
export const holdSeats = (showtimeId: Id, seats: string[]): Promise<Response> =>
  req(`/holds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showtimeId, seats }),
  });

// Nhả toàn bộ ghế đang giữ của mình ở 1 suất.
export const releaseSeats = (showtimeId: Id): Promise<Response> =>
  req(`/holds?showtimeId=${showtimeId}`, { method: "DELETE" });

export const createBooking = (booking: Partial<Booking>): Promise<Booking> =>
  req(`/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  }).then((r) => r.json());

// GET /bookings: gateway tự lọc — user thường chỉ nhận đơn của mình, admin nhận tất cả.
export const getBookings = () => get<Booking[]>(`/bookings`);

export const getConcessions = () => get<Concession[]>(`/concessions`);

// --- Admin CRUD (gateway yêu cầu quyền admin cho các thao tác ghi) ---
const post = <T>(path: string, body: unknown): Promise<T> =>
  req(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
const patch = <T>(path: string, body: unknown): Promise<T> =>
  req(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
const del = (path: string): Promise<Response> =>
  req(path, { method: "DELETE" });

export const createMovie = (b: Partial<Movie>) => post<Movie>("/movies", b);
export const updateMovie = (id: Id, p: Partial<Movie>) =>
  patch<Movie>(`/movies/${id}`, p);
export const deleteMovie = (id: Id) => del(`/movies/${id}`);

export const createRoom = (b: Partial<Room>) => post<Room>("/rooms", b);
export const updateRoom = (id: Id, p: Partial<Room>) =>
  patch<Room>(`/rooms/${id}`, p);
export const deleteRoom = (id: Id) => del(`/rooms/${id}`);

export const createShowtime = (b: Partial<Showtime>) =>
  post<Showtime>("/showtimes", b);
export const updateShowtime = (id: Id, p: Partial<Showtime>) =>
  patch<Showtime>(`/showtimes/${id}`, p);
export const deleteShowtime = (id: Id) => del(`/showtimes/${id}`);

export const updateBooking = (id: Id, p: Partial<Booking>) =>
  patch<Booking>(`/bookings/${id}`, p);
export const deleteBooking = (id: Id) => del(`/bookings/${id}`);
