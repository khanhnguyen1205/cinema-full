// Mô hình dữ liệu dùng chung — khớp các collection trong db.json.
// User ở client là bản "safe" (không kèm password hash).

export type Role = "user" | "admin";

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
}

export interface Movie {
  id: number;
  title: string;
  poster?: string;
  description?: string;
  duration: number;
  genre: string;
  rating?: number;
}

export interface City {
  id: number;
  name: string;
}

export interface Cinema {
  id: number;
  cityId: number;
  name: string;
  address?: string;
}

export type RoomType = "2D" | "3D" | "IMAX";

export interface Room {
  id: number;
  cinemaId: number;
  name: string;
  type: RoomType;
  rows: number;
  cols: number;
  vipRows?: string[];
  coupleRows?: string[];
  aisleAfterCols?: number[];
}

export interface Showtime {
  id: number;
  movieId: number;
  roomId: number;
  time: string; // ISO
  price: number; // giá ghế thường
  bookedSeats?: string[];
}

export type SeatTypeKey = "standard" | "vip" | "couple";

export interface Seat {
  seatNumber: string;
  row: string;
  col: number;
  isVip: boolean;
  isCouple: boolean;
}

export interface SeatRow {
  row: string;
  seats: Seat[];
  isCouple: boolean;
}

export interface Concession {
  id: number;
  name: string;
  category: string;
  price: number;
  description?: string;
  image?: string;
}

export interface BookingConcession {
  id: number;
  name: string;
  qty: number;
  price: number;
}

export interface Booking {
  id: number;
  movieId: number;
  showtimeId: number;
  cinemaId: number;
  roomId: number;
  seats: string[];
  seatTypes: { standard: number; vip: number; couple?: number };
  concessions?: BookingConcession[];
  paymentMethod?: string;
  userId: number;
  userName?: string;
  seatTotal?: number;
  fnbTotal?: number;
  serviceFee?: number;
  totalPrice: number;
  createdAt: string;
}

export interface Review {
  id: number;
  movieId: number;
  userId: number;
  userName: string;
  rating: number; // 1..5
  comment?: string;
  verified: boolean;
  createdAt: string;
}
