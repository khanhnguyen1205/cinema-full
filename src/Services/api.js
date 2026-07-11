const BASE_URL = "http://localhost:9999";

export const getMovies = () =>
  fetch(`${BASE_URL}/movies`).then(res => res.json());

export const getMovie = (id) =>
  fetch(`${BASE_URL}/movies/${id}`).then(res => res.json());

export const getShowtimes = (movieId) =>
  fetch(`${BASE_URL}/showtimes?movieId=${movieId}`).then(res => res.json());

export const getShowtime = (id) =>
  fetch(`${BASE_URL}/showtimes/${id}`).then(res => res.json());

export const getAllShowtimes = () =>
  fetch(`${BASE_URL}/showtimes`).then(res => res.json());

export const getSeats = (showtimeId) =>
  fetch(`${BASE_URL}/seats?showtimeId=${showtimeId}`).then(res => res.json());

export const updateSeat = (id) =>
  fetch(`${BASE_URL}/seats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isBooked: true })
  });

export const createBooking = (data) =>
  fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(res => res.json());

export const getBookings = () =>
  fetch(`${BASE_URL}/bookings`).then(res => res.json());
