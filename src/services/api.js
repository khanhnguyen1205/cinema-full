// Data qua cong co phan quyen o auth server (:4000/api), khong goi json-server (:9999) truc tiep.
// credentials:"include" de gui cookie phien -> gateway biet user/role.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const req = (path, opts = {}) =>
  fetch(`${BASE_URL}${path}`, { credentials: "include", ...opts });
const get = (path) => req(path).then((r) => r.json());

export const getMovies = () => get(`/movies`);
export const getMovie = (id) => get(`/movies/${id}`);

export const getShowtimes = (movieId) => get(`/showtimes?movieId=${movieId}`);
export const getShowtime = (id) => get(`/showtimes/${id}`);
export const getAllShowtimes = () => get(`/showtimes`);
export const getShowtimesByRoom = (roomId) => get(`/showtimes?roomId=${roomId}`);

export const getCities = () => get(`/cities`);
export const getCinemas = (cityId) => get(`/cinemas${cityId ? `?cityId=${cityId}` : ""}`);
export const getCinema = (id) => get(`/cinemas/${id}`);
export const getRooms = (cinemaId) => get(`/rooms${cinemaId ? `?cinemaId=${cinemaId}` : ""}`);
export const getRoom = (id) => get(`/rooms/${id}`);

// Suất chiếu của 1 rạp: lấy các phòng của rạp rồi gom showtimes theo roomId
export const getShowtimesByCinema = async (cinemaId) => {
  const rooms = await getRooms(cinemaId);
  const lists = await Promise.all(rooms.map((r) => getShowtimesByRoom(r.id)));
  return lists.flat();
};

// Ghế đã đặt của 1 suất (chỉ số ghế, không kèm thông tin cá nhân) — dùng cho sơ đồ ghế.
export const getOccupiedSeats = (showtimeId) =>
  get(`/occupied-seats?showtimeId=${showtimeId}`).then((d) => d.seats || []);

// Giữ ghế phía server: gửi toàn bộ ghế đang chọn (đặt lại + gia hạn TTL, kiêm heartbeat).
// Trả nguyên Response để nơi gọi đọc status (409 = ghế vừa bị người khác giữ).
export const holdSeats = (showtimeId, seats) =>
  req(`/holds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showtimeId, seats }),
  });

// Nhả toàn bộ ghế đang giữ của mình ở 1 suất.
export const releaseSeats = (showtimeId) =>
  req(`/holds?showtimeId=${showtimeId}`, { method: "DELETE" });

export const createBooking = (booking) =>
  req(`/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  }).then((r) => r.json());

// GET /bookings: gateway tự lọc — user thường chỉ nhận đơn của mình, admin nhận tất cả.
export const getBookings = () => get(`/bookings`);

export const getConcessions = () => get(`/concessions`);

// --- Admin CRUD (gateway yêu cầu quyền admin cho các thao tác ghi) ---
const post = (path, body) => req(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const patch = (path, body) => req(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const del = (path) => req(path, { method: "DELETE" });

export const createMovie = (b) => post("/movies", b);
export const updateMovie = (id, p) => patch(`/movies/${id}`, p);
export const deleteMovie = (id) => del(`/movies/${id}`);

export const createRoom = (b) => post("/rooms", b);
export const updateRoom = (id, p) => patch(`/rooms/${id}`, p);
export const deleteRoom = (id) => del(`/rooms/${id}`);

export const createShowtime = (b) => post("/showtimes", b);
export const updateShowtime = (id, p) => patch(`/showtimes/${id}`, p);
export const deleteShowtime = (id) => del(`/showtimes/${id}`);

export const updateBooking = (id, p) => patch(`/bookings/${id}`, p);
export const deleteBooking = (id) => del(`/bookings/${id}`);
