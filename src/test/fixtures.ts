// Dữ liệu mẫu dùng chung cho test client. Cố ý NHỎ và tự giải thích —
// không dùng db.json (16 phim / 52 suất) vì assertion sẽ mong manh và khó đọc.
import type {
  Booking,
  Cinema,
  City,
  Concession,
  Movie,
  Review,
  Room,
  Showtime,
  User,
} from "types";

// Mốc thời gian tính từ "bây giờ" để suất tương lai luôn là tương lai,
// bất kể chạy test lúc nào. Định dạng khớp DB: chuỗi giờ ĐỊA PHƯƠNG, không có "Z".
const shift = (hours: number): string => {
  const d = new Date(Date.now() + hours * 3600_000);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

export const fx = {
  cities: [
    { id: 1, name: "Hà Nội" },
    { id: 2, name: "Đà Nẵng" },
  ] as City[],

  cinemas: [
    { id: 1, cityId: 1, name: "Cinema Hoàn Kiếm", address: "1 Tràng Tiền" },
    { id: 2, cityId: 2, name: "Cinema Hải Châu", address: "5 Bạch Đằng" },
  ] as Cinema[],

  rooms: [
    {
      id: 1,
      cinemaId: 1,
      name: "Phòng 1",
      type: "2D",
      rows: 5,
      cols: 6,
      vipRows: ["C"],
      coupleRows: ["E"],
      aisleAfterCols: [3],
    },
    {
      id: 2,
      cinemaId: 2,
      name: "Phòng IMAX",
      type: "IMAX",
      rows: 4,
      cols: 6,
      vipRows: [],
      coupleRows: [],
      aisleAfterCols: [],
    },
  ] as Room[],

  movies: [
    {
      id: 1,
      title: "Điện Biên Phủ",
      poster: "",
      description: "Phim thử nghiệm số một.",
      duration: 120,
      genre: "Action",
      rating: 8.4,
    },
    {
      id: 2,
      title: "Endgame",
      poster: "",
      description: "Phim thử nghiệm số hai.",
      duration: 95,
      genre: "Sci-Fi",
      rating: 7.1,
    },
    // Phim KHÔNG có suất nào — để test trạng thái "chưa có lịch chiếu".
    {
      id: 3,
      title: "Phim Chưa Xếp Lịch",
      poster: "",
      description: "Phim thử nghiệm số ba.",
      duration: 80,
      genre: "Drama",
      rating: 6.2,
    },
  ] as Movie[],

  showtimes: [
    // Suất TƯƠNG LAI — đặt vé được.
    {
      id: 1,
      movieId: 1,
      roomId: 1,
      time: shift(48),
      price: 90000,
      bookedSeats: ["A1", "A2"],
    },
    // Suất QUÁ KHỨ — không được chào bán.
    {
      id: 2,
      movieId: 1,
      roomId: 1,
      time: shift(-48),
      price: 90000,
      bookedSeats: [],
    },
    {
      id: 3,
      movieId: 2,
      roomId: 2,
      time: shift(72),
      price: 120000,
      bookedSeats: [],
    },
  ] as Showtime[],

  concessions: [
    {
      id: 1,
      name: "Bắp rang bơ",
      category: "popcorn",
      price: 45000,
      description: "Cỡ vừa",
      image: "🍿",
    },
    {
      id: 2,
      name: "Combo đôi",
      category: "combo",
      price: 89000,
      description: "2 bắp 2 nước",
      image: "🍟",
    },
  ] as Concession[],

  user: {
    id: 2,
    fullName: "Người Dùng",
    email: "a@cinema.vn",
    role: "user",
  } as User,
  admin: {
    id: 1,
    fullName: "Quản Trị",
    email: "admin@cinema.vn",
    role: "admin",
  } as User,

  bookings: [
    {
      id: 1,
      movieId: 1,
      showtimeId: 1,
      cinemaId: 1,
      roomId: 1,
      seats: ["B3"],
      seatTypes: { standard: 1, vip: 0, couple: 0 },
      concessions: [],
      paymentMethod: "counter",
      userId: 2,
      userName: "Người Dùng",
      seatTotal: 90000,
      fnbTotal: 0,
      serviceFee: 15000,
      totalPrice: 105000,
      createdAt: shift(-1),
      paymentRef: null,
    },
  ] as Booking[],

  reviews: [
    {
      id: 1,
      movieId: 1,
      userId: 2,
      userName: "Người Dùng",
      rating: 5,
      comment: "Rất hay.",
      verified: true,
      createdAt: shift(-2),
    },
    // Review của NGƯỜI KHÁC (không phải fx.user) và chưa xác thực đã xem —
    // để phân biệt "đánh giá của bạn" với đánh giá của người lạ.
    {
      id: 2,
      movieId: 1,
      userId: 9,
      userName: "Khán Giả Khác",
      rating: 3,
      comment: "Tạm được.",
      verified: false,
      createdAt: shift(-3),
    },
  ] as Review[],
};
