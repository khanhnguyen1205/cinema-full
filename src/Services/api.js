const BASE_URL = "http://localhost:9999";

export const getMovies = () => fetch(`${BASE_URL}/movies`).then(r => r.json());
export const getMovie = (id) => fetch(`${BASE_URL}/movies/${id}`).then(r => r.json());

export const getShowtimes = (movieId) => fetch(`${BASE_URL}/showtimes?movieId=${movieId}`).then(r => r.json());
export const getShowtime = (id) => fetch(`${BASE_URL}/showtimes/${id}`).then(r => r.json());
export const getAllShowtimes = () => fetch(`${BASE_URL}/showtimes`).then(r => r.json());
export const getShowtimesByRoom = (roomId) => fetch(`${BASE_URL}/showtimes?roomId=${roomId}`).then(r => r.json());

export const getCities = () => fetch(`${BASE_URL}/cities`).then(r => r.json());
export const getCinemas = (cityId) =>
  fetch(`${BASE_URL}/cinemas${cityId ? `?cityId=${cityId}` : ""}`).then(r => r.json());
export const getCinema = (id) => fetch(`${BASE_URL}/cinemas/${id}`).then(r => r.json());
export const getRooms = (cinemaId) =>
  fetch(`${BASE_URL}/rooms${cinemaId ? `?cinemaId=${cinemaId}` : ""}`).then(r => r.json());
export const getRoom = (id) => fetch(`${BASE_URL}/rooms/${id}`).then(r => r.json());

// Suất chiếu của 1 rạp: lấy các phòng của rạp rồi gom showtimes theo roomId
export const getShowtimesByCinema = async (cinemaId) => {
  const rooms = await getRooms(cinemaId);
  const lists = await Promise.all(rooms.map(r => getShowtimesByRoom(r.id)));
  return lists.flat();
};

export const createBooking = (booking) =>
  fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking)
  }).then(r => r.json());

export const getBookings = () => fetch(`${BASE_URL}/bookings`).then(r => r.json());
