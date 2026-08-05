/**
 * Sinh dữ liệu cơ học rồi NỐI vào db.json. Không bao giờ sửa hay xoá dòng đã có.
 *
 * Dữ liệu "biên tập" (phim nào, rạp nào, tên người) nằm ở scripts/seed-data/.
 * Ở đây chỉ có phần thuần tổ hợp: suất chiếu, người dùng, đơn, đánh giá.
 *
 * PRNG có seed cố định ⇒ chạy lại ra kết quả y hệt, nên diff db.json ổn định.
 *
 * Chạy: npm run seed:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { makeRng } from "./lib/rng.mjs";
import {
  ROOM_TYPE_PRICE,
  SERVICE_FEE,
  flatSeats,
  priceOf,
  seatType,
} from "./lib/seed-pricing.mjs";
import { NEW_CONCESSIONS } from "./seed-data/concessions.mjs";
import { COMMENTS, NEW_USERS, PASSWORD_HASH } from "./seed-data/people.mjs";
import { NEW_CINEMAS, NEW_CITIES, NEW_ROOMS } from "./seed-data/venues.mjs";

const DB_PATH = new URL("../db.json", import.meta.url);
const db = JSON.parse(readFileSync(DB_PATH, "utf8"));
const verified = JSON.parse(
  readFileSync(
    new URL("./seed-data/images.verified.json", import.meta.url),
    "utf8",
  ),
);

const rng = makeRng(20260805);

// Bộ đếm id, KHÔNG gọi lại max() mỗi vòng: với ~840 suất chiếu thì
// Math.max(...mang) vừa là O(n²) vừa tràn stack khi mảng đủ lớn.
const counter = (rows) => {
  let n = rows.length ? Math.max(...rows.map((r) => r.id)) : 0;
  return () => ++n;
};

// --- 1. Thành phố / rạp / phòng / phim (biên tập -> chỉ cần cấp id) ---
const nextCityId = counter(db.cities);
const cityIdByName = new Map(db.cities.map((c) => [c.name, c.id]));
for (const c of NEW_CITIES) {
  const id = nextCityId();
  db.cities.push({ id, name: c.name });
  cityIdByName.set(c.name, id);
}

const nextCinemaId = counter(db.cinemas);
const cinemaIdByName = new Map(db.cinemas.map((c) => [c.name, c.id]));
for (const c of NEW_CINEMAS) {
  const id = nextCinemaId();
  db.cinemas.push({
    id,
    name: c.name,
    address: c.address,
    cityId: cityIdByName.get(c.cityName),
  });
  cinemaIdByName.set(c.name, id);
}

const nextRoomId = counter(db.rooms);
for (const r of NEW_ROOMS) {
  db.rooms.push({
    id: nextRoomId(),
    name: r.name,
    type: r.type,
    rows: r.rows,
    cols: r.cols,
    vipRows: r.vipRows ?? [],
    coupleRows: r.coupleRows ?? [],
    aisleAfterCols: r.aisleAfterCols ?? [],
    cinemaId: cinemaIdByName.get(r.cinemaName),
  });
}

const nextMovieId = counter(db.movies);
for (const m of verified.movies) {
  db.movies.push({
    id: nextMovieId(),
    title: m.title,
    poster: m.poster,
    backdrop: m.backdrop,
    description: m.description,
    duration: m.duration,
    genre: m.genre,
    rating: m.rating,
  });
}

// --- 2. Người dùng và bắp nước ---
// Không phải để cho đông: @@unique([movieId, userId]) đặt trần CỨNG ở số user.
// 4 user nghĩa là tối đa 4 đánh giá mỗi phim, sinh bao nhiêu review cũng vô ích.
const nextUserId = counter(db.users);
for (const u of NEW_USERS) {
  db.users.push({
    id: nextUserId(),
    fullName: u.fullName,
    email: u.email,
    password: PASSWORD_HASH,
    role: "user",
  });
}

const nextConcessionId = counter(db.concessions);
for (const c of NEW_CONCESSIONS) {
  db.concessions.push({ id: nextConcessionId(), ...c });
}

// --- 3. Suất chiếu ---
// NGÀY CỨNG phải giữ đúng 7 ngày này: planShift neo theo ngày SỚM NHẤT để đẩy nó
// về hôm nay−2. Rơi ra ngoài là lệch toàn bộ cửa sổ lịch chiếu.
const DAYS = [
  "2026-07-14",
  "2026-07-15",
  "2026-07-16",
  "2026-07-17",
  "2026-07-18",
  "2026-07-19",
  "2026-07-20",
];
const SLOTS = ["09:30", "12:15", "15:00", "18:00", "21:00"];

// 11 suất cũ đã ở 21:00. Bỏ qua cặp (phòng, giờ) đã tồn tại, nếu không một phòng
// chiếu hai phim cùng lúc.
const takenSlot = new Set(db.showtimes.map((s) => `${s.roomId}|${s.time}`));
const movieIds = db.movies.map((m) => m.id);
const nextShowtimeId = counter(db.showtimes);
let cursor = 0;

for (const room of db.rooms) {
  // Mỗi phòng lệch một bước khác nhau -> cùng một giờ, các phòng chiếu phim khác
  // nhau, và mỗi phim có suất ở nhiều rạp.
  cursor += 3;
  const seats = flatSeats(room).map((s) => s.seatNumber);
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const time = `${day}T${slot}:00`;
      const key = `${room.id}|${time}`;
      if (takenSlot.has(key)) continue;
      takenSlot.add(key);
      const sold = rng.int(
        Math.floor(seats.length * 0.05),
        Math.floor(seats.length * 0.15),
      );
      db.showtimes.push({
        id: nextShowtimeId(),
        movieId: movieIds[cursor++ % movieIds.length],
        roomId: room.id,
        time,
        price: ROOM_TYPE_PRICE[room.type],
        bookedSeats: rng.sample(seats, sold).sort(),
      });
    }
  }
}

// --- 4. Đơn đặt vé ---
// createdAt rải 30 ngày TRƯỚC cửa sổ chiếu -> biểu đồ doanh thu admin có đường
// cong thật. Trước đó cả 3 đơn cùng một ngày nên biểu đồ gần như phẳng.
// Cùng một offset sẽ được seed.ts dịch cho mọi bảng nên quan hệ thời gian giữ
// nguyên.
const BOOK_DAYS = Array.from({ length: 30 }, (_, i) =>
  new Date(Date.UTC(2026, 5, 14) + i * 86400000).toISOString().slice(0, 10),
);

const roomById = new Map(db.rooms.map((r) => [r.id, r]));
const seatsUsed = new Map();
for (const s of db.showtimes) seatsUsed.set(s.id, new Set(s.bookedSeats));
for (const b of db.bookings) {
  const set = seatsUsed.get(b.showtimeId) ?? new Set();
  b.seats.forEach((x) => set.add(x));
  seatsUsed.set(b.showtimeId, set);
}

const buyers = db.users.filter((u) => u.role !== "admin");
const nextBookingId = counter(db.bookings);
const TARGET_BOOKINGS = 150;

for (let n = 0; n < TARGET_BOOKINGS; n++) {
  const st = rng.pick(db.showtimes);
  const room = roomById.get(st.roomId);
  const used = seatsUsed.get(st.id);
  const free = flatSeats(room).filter((s) => !used.has(s.seatNumber));
  if (free.length < 4) continue;

  const chosen = rng.sample(free, rng.int(1, 4));
  chosen.forEach((s) => used.add(s.seatNumber));

  const seatTypes = { standard: 0, vip: 0, couple: 0 };
  let seatTotal = 0;
  for (const s of chosen) {
    seatTypes[seatType(s)]++;
    seatTotal += priceOf(s, st.price);
  }

  // 0-2 món bắp nước, mỗi món 1-2 phần.
  const fnb = {};
  let fnbTotal = 0;
  for (const c of rng.sample(db.concessions, rng.int(0, 2))) {
    const qty = rng.int(1, 2);
    fnb[c.id] = qty;
    fnbTotal += c.price * qty;
  }

  const user = rng.pick(buyers);
  const hh = String(rng.int(8, 22)).padStart(2, "0");
  db.bookings.push({
    id: nextBookingId(),
    movieId: st.movieId,
    showtimeId: st.id,
    cinemaId: room.cinemaId,
    roomId: st.roomId,
    seats: chosen.map((s) => s.seatNumber).sort(),
    seatTypes,
    concessions: Object.keys(fnb).length ? fnb : undefined,
    paymentMethod: rng.chance(0.45) ? "card" : "counter",
    userId: user.id,
    userName: user.fullName,
    seatTotal,
    fnbTotal,
    serviceFee: SERVICE_FEE,
    totalPrice: seatTotal + fnbTotal + SERVICE_FEE,
    createdAt: `${rng.pick(BOOK_DAYS)}T${hh}:${rng.pick(["05", "17", "30", "42", "58"])}:00`,
  });
}

writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + "\n");
console.log(
  `phim ${db.movies.length} · tp ${db.cities.length} · rạp ${db.cinemas.length} · phòng ${db.rooms.length} · suất ${db.showtimes.length} · user ${db.users.length} · đơn ${db.bookings.length}`,
);
