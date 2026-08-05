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

// Chặn chạy chồng. Script CHỈ NỐI THÊM nên chạy lần hai sẽ nhân đôi mọi thứ
// trong im lặng — đã tự dính một lần: 40 phim thành 64, 879 suất thành 2136.
// Nhận biết bằng chính dữ liệu biên tập: phim đầu tiên của đợt này đã có chưa.
const MARKER = verified.movies[0]?.title;
if (MARKER && db.movies.some((m) => m.title === MARKER)) {
  console.error(
    `\n❌ db.json da chua du lieu sinh san ("${MARKER}"). Script nay chi NOI THEM nen chay lai se nhan doi.\n` +
      `   Muon sinh lai: khoi phuc db.json goc truoc, vi du\n` +
      `     git checkout <commit truoc dot sinh> -- db.json\n`,
  );
  process.exit(1);
}

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

// Mỗi phòng lệch giờ một chút. Không có cái này thì cả 24 phòng chiếu đúng cùng
// 5 khung giờ, và dải "Suất chiếu gần nhất" ở trang chủ hiện 6 thẻ đều ghi
// 09:30 — nhìn là biết dữ liệu máy sinh. Rạp thật cũng so le để khách ra vào
// không dồn một lúc.
const ROOM_OFFSETS = [0, 25, 10, 40, 5, 30, 15, 45, 20, 35, 50, 55];
const addMinutes = (hhmm, mins) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + m + mins) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

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
  const offset = ROOM_OFFSETS[room.id % ROOM_OFFSETS.length];
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const time = `${day}T${addMinutes(slot, offset)}:00`;
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

// --- 5. Đánh giá ---
// Ba ràng buộc, cái nào cũng chặn bằng mã chứ không bằng ý thức:
//
//  1. @@unique([movieId, userId]) — một user chỉ đánh giá một phim một lần.
//  2. KHÔNG được sinh (movieId 7, userId 1). e2e/reviews.spec.ts chọn đúng cặp
//     đó VÌ NÓ TRỐNG, để test tự đăng review mà không dính 409. Sinh vào là test
//     đỏ, mà nguyên nhân nhìn rất giống lỗi ứng dụng.
//  3. verified chỉ true khi user đó THẬT SỰ có đơn phim đó, đặt TRƯỚC ngày đánh
//     giá — đúng nghĩa badge "Đã xem", bắt chước cách gateway tính lúc tạo.
const pairs = new Set(db.reviews.map((r) => `${r.movieId}|${r.userId}`));
pairs.add("7|1");

const boughtOn = new Map();
for (const b of db.bookings) {
  const k = `${b.userId}|${b.movieId}`;
  const day = b.createdAt.slice(0, 10);
  if (!boughtOn.has(k) || day < boughtOn.get(k)) boughtOn.set(k, day);
}

const REVIEW_DAYS = Array.from({ length: 28 }, (_, i) =>
  new Date(Date.UTC(2026, 5, 16) + i * 86400000).toISOString().slice(0, 10),
);
// Lệch về 4-5 sao cho thật: khán giả chịu khó viết đánh giá thường là người thích.
const STARS = [5, 5, 5, 5, 4, 4, 4, 3, 3, 2, 1];

// Ai đã mua vé phim nào — dùng để ưu tiên người đánh giá.
const buyersOf = new Map();
for (const b of db.bookings) {
  if (!buyersOf.has(b.movieId)) buyersOf.set(b.movieId, new Set());
  buyersOf.get(b.movieId).add(b.userId);
}

const nextReviewId = counter(db.reviews);
for (const movie of db.movies) {
  const want = rng.int(3, 8);
  // Ưu tiên người ĐÃ ĐẶT VÉ phim này rồi mới lấy thêm người khác. Đời thật cũng
  // vậy: người bỏ công viết đánh giá thường là người đã xem. Nếu chọn thuần ngẫu
  // nhiên trên 29 người thì badge "Đã xem" gần như không bao giờ xuất hiện, và
  // một tính năng có thật trông như không chạy.
  const watched = buyers.filter((u) => buyersOf.get(movie.id)?.has(u.id));
  const others = buyers.filter((u) => !buyersOf.get(movie.id)?.has(u.id));
  const picked = [
    ...rng.sample(watched, Math.min(watched.length, want)),
    ...rng.sample(others, Math.max(0, want - watched.length)),
  ];

  for (const user of picked) {
    const key = `${movie.id}|${user.id}`;
    if (pairs.has(key)) continue;
    pairs.add(key);

    const rating = rng.pick(STARS);
    const bought = boughtOn.get(`${user.id}|${movie.id}`);
    // Đã mua thì viết đánh giá SAU ngày mua — không thì cờ verified vô nghĩa và
    // dòng thời gian trên trang phim đọc ra vô lý.
    const after = bought ? REVIEW_DAYS.filter((d) => d >= bought) : REVIEW_DAYS;
    const day = rng.pick(after.length ? after : REVIEW_DAYS);
    const hh = String(rng.int(8, 22)).padStart(2, "0");
    db.reviews.push({
      id: nextReviewId(),
      movieId: movie.id,
      userId: user.id,
      userName: user.fullName,
      rating,
      comment: rng.pick(COMMENTS[rating]),
      verified: Boolean(bought && bought <= day),
      createdAt: `${day}T${hh}:${rng.pick(["04", "19", "27", "45", "51"])}:00.000Z`,
    });
  }
}

writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + "\n");
console.log(
  `phim ${db.movies.length} · tp ${db.cities.length} · rạp ${db.cinemas.length} · phòng ${db.rooms.length} · suất ${db.showtimes.length} · user ${db.users.length} · đơn ${db.bookings.length} · đánh giá ${db.reviews.length}`,
);
