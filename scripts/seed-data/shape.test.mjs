// Kiểm hình dạng dữ liệu biên tập trước khi generator đụng vào.
//
// Chạy bằng: node scripts/seed-data/shape.test.mjs
// KHÔNG dùng Vitest: hai project của Vitest chỉ quét src/** và server/**.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NEW_CONCESSIONS } from "./concessions.mjs";
import { MOVIE_POOL } from "./movies.mjs";
import { COMMENTS, NEW_USERS, PASSWORD_HASH } from "./people.mjs";
import { NEW_CINEMAS, NEW_CITIES, NEW_ROOMS } from "./venues.mjs";

const read = (p) =>
  JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const db = read("../../db.json");
const tmdb = read("./tmdb.json");

// 8 mã thể loại có nhãn dịch trong src/i18n/locales/*.json. Mã lạ sẽ hiện nguyên
// mã thay vì nhãn tiếng Việt.
const GENRES = [
  "Action",
  "Sci-Fi",
  "Horror",
  "Drama",
  "Comedy",
  "Crime",
  "Animation",
  "Romance",
];

// --- Phim ---
assert.ok(MOVIE_POOL.length >= 30, `pool phim qua nho: ${MOVIE_POOL.length}`);
const oldTitles = new Set(db.movies.map((m) => m.title));
const poolTitles = new Set();
for (const m of MOVIE_POOL) {
  assert.ok(!oldTitles.has(m.title), `trung phim da co: ${m.title}`);
  assert.ok(!poolTitles.has(m.title), `trung phim trong pool: ${m.title}`);
  poolTitles.add(m.title);
  assert.ok(GENRES.includes(m.genre), `the loai la: ${m.genre} (${m.title})`);
  assert.ok(m.description?.length > 20, `mo ta qua ngan: ${m.title}`);
}
for (const g of GENRES) {
  const n = MOVIE_POOL.filter((m) => m.genre === g).length;
  assert.ok(n >= 3, `the loai ${g} chi co ${n} phim, can it nhat 3`);
}

// --- Dữ liệu TMDB đã tra ---
assert.ok(
  tmdb.movies.length >= 24,
  `tmdb.json chi co ${tmdb.movies.length} phim, can >= 24`,
);
const seenPoster = new Map();
const seenBackdrop = new Map();
for (const m of [...db.movies, ...tmdb.movies]) {
  assert.match(
    m.poster,
    /^https:\/\/image\.tmdb\.org\/t\/p\//,
    `poster sai dang: ${m.title}`,
  );
  assert.ok(
    !seenPoster.has(m.poster),
    `poster dung chung: ${m.title} == ${seenPoster.get(m.poster)}`,
  );
  seenPoster.set(m.poster, m.title);
  if (m.backdrop) {
    assert.match(
      m.backdrop,
      /^https:\/\/image\.tmdb\.org\/t\/p\//,
      `backdrop sai dang: ${m.title}`,
    );
    assert.ok(
      !seenBackdrop.has(m.backdrop),
      `backdrop dung chung: ${m.title} == ${seenBackdrop.get(m.backdrop)}`,
    );
    seenBackdrop.set(m.backdrop, m.title);
  }
}
for (const m of tmdb.movies) {
  assert.ok(
    m.duration >= 80 && m.duration <= 240,
    `thoi luong vo ly: ${m.title} ${m.duration}p`,
  );
  assert.ok(
    m.rating >= 5 && m.rating <= 10,
    `diem vo ly: ${m.title} ${m.rating}`,
  );
}

// --- Rạp / phòng ---
assert.equal(NEW_CITIES.length, 2);
assert.equal(NEW_CINEMAS.length, 7);
assert.equal(NEW_ROOMS.length, 14);
const cityNames = new Set([
  ...db.cities.map((c) => c.name),
  ...NEW_CITIES.map((c) => c.name),
]);
for (const c of NEW_CINEMAS)
  assert.ok(cityNames.has(c.cityName), `thanh pho la: ${c.cityName}`);
const cinemaNames = new Set(NEW_CINEMAS.map((c) => c.name));
const roomKeys = new Set();
for (const r of NEW_ROOMS) {
  assert.ok(cinemaNames.has(r.cinemaName), `rap la: ${r.cinemaName}`);
  assert.ok(["2D", "3D", "IMAX"].includes(r.type), `loai phong la: ${r.type}`);
  const k = `${r.cinemaName}|${r.name}`;
  assert.ok(!roomKeys.has(k), `trung ten phong trong cung rap: ${k}`);
  roomKeys.add(k);
  // Hàng ghế đôi / VIP phải nằm trong số hàng thật của phòng.
  const maxRow = String.fromCharCode(64 + r.rows);
  for (const row of [...(r.vipRows ?? []), ...(r.coupleRows ?? [])]) {
    assert.ok(
      row <= maxRow,
      `phong ${k} chi co ${r.rows} hang (toi ${maxRow}) nhung khai hang ${row}`,
    );
  }
}
assert.ok(
  NEW_ROOMS.filter((r) => (r.coupleRows ?? []).length).length >= 6,
  "qua it phong co ghe doi",
);

// --- Người dùng ---
assert.equal(NEW_USERS.length, 26);
assert.match(
  PASSWORD_HASH,
  /^\$2[aby]\$\d{2}\$/,
  "PASSWORD_HASH chua duoc dan",
);
const oldEmails = new Set(db.users.map((u) => u.email));
const emails = new Set();
for (const u of NEW_USERS) {
  assert.ok(!oldEmails.has(u.email), `trung email da co: ${u.email}`);
  assert.ok(!emails.has(u.email), `trung email trong pool: ${u.email}`);
  emails.add(u.email);
}
for (const star of [1, 2, 3, 4, 5]) {
  assert.ok(COMMENTS[star]?.length >= 6, `qua it binh luan ${star} sao`);
}

// --- Bắp nước ---
assert.equal(NEW_CONCESSIONS.length, 6);
const oldFnb = new Set(db.concessions.map((c) => c.name));
for (const c of NEW_CONCESSIONS) {
  assert.ok(!oldFnb.has(c.name), `trung mon da co: ${c.name}`);
  assert.ok(c.price > 0 && c.price % 1000 === 0, `gia le: ${c.name}`);
}

console.log("✅ Hinh dang du lieu bien tap hop le.");
