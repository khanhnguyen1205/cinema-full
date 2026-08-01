// Server giả ở tầng HTTP: test đi qua services/* và queries/* THẬT.
// URL khớp VITE_API_URL / VITE_AUTH_URL đã ghim trong vite.config.mjs.
import { http, HttpResponse } from "msw";
import type { Booking, Movie, Review, Room, Showtime } from "types";
import { fx } from "../fixtures";

const API = "http://localhost:4000/api";
const AUTH = "http://localhost:4000";

// Các bảng CÓ GHI là bản sao thay đổi được, reset sau mỗi test (gọi trong
// src/test/setup.ts). Gom vào một object để handler luôn đọc mảng hiện tại —
// nếu để biến rời rồi gán lại khi reset, handler sẽ ôm mảng cũ của test trước.
export const db = {
  movies: [] as Movie[],
  rooms: [] as Room[],
  showtimes: [] as Showtime[],
  bookings: [] as Booking[],
  reviews: [] as Review[],
};

export const resetFixtureDb = () => {
  db.movies = fx.movies.map((r) => ({ ...r }));
  db.rooms = fx.rooms.map((r) => ({ ...r }));
  db.showtimes = fx.showtimes.map((r) => ({ ...r }));
  db.bookings = fx.bookings.map((r) => ({ ...r }));
  db.reviews = fx.reviews.map((r) => ({ ...r }));
};
resetFixtureDb();

const byId = <T extends { id: number }>(rows: T[], raw: string | undefined) =>
  rows.find((r) => String(r.id) === raw);

const found = <T>(row: T | undefined) =>
  row
    ? HttpResponse.json(row)
    : HttpResponse.json({ error: "Not found" }, { status: 404 });

const notFound = () =>
  HttpResponse.json({ error: "Not found" }, { status: 404 });

// Bộ 3 POST/PATCH/DELETE cho một bảng admin. Giữ đúng hợp đồng của
// server/src/api/repo.ts: POST -> 201 + hàng vừa tạo, DELETE -> {} + 200,
// id không có -> 404. Ghi thật vào bảng bản sao để danh sách sau khi
// invalidate phản ánh đúng thay đổi (test giả mà không ghi thì xanh giả).
const crudFor = <T extends { id: number }>(path: string, rows: () => T[]) => [
  http.post(`${API}/${path}`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const list = rows();
    const row = { ...body, id: Math.max(0, ...list.map((r) => r.id)) + 1 } as T;
    list.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  http.patch(`${API}/${path}/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const row = byId(rows(), params.id as string);
    if (!row) return notFound();
    Object.assign(row, body);
    return HttpResponse.json(row);
  }),
  http.delete(`${API}/${path}/:id`, ({ params }) => {
    const list = rows();
    const i = list.findIndex((r) => String(r.id) === params.id);
    if (i < 0) return notFound();
    list.splice(i, 1);
    return HttpResponse.json({});
  }),
];

// Mặc định: KHÁCH (chưa đăng nhập). Test nào cần user thì server.use(...) đè lại.
export const handlers = [
  http.get(`${AUTH}/auth/me`, () =>
    HttpResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }),
  ),
  http.post(`${AUTH}/auth/refresh`, () =>
    HttpResponse.json({ error: "Phiên hết hạn." }, { status: 401 }),
  ),
  // Server thật trả 204 không thân (auth/routes.ts).
  http.post(
    `${AUTH}/auth/logout`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Đúng một cặp thông tin đăng nhập là hợp lệ; sai thì 401 với thông điệp
  // CHUNG CHUNG y như server thật (không tiết lộ email có tồn tại hay không).
  http.post(`${AUTH}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === fx.user.email && body.password === "123456")
      return HttpResponse.json(fx.user);
    return HttpResponse.json(
      { error: "Email hoặc mật khẩu không đúng." },
      { status: 401 },
    );
  }),
  http.post(`${AUTH}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { fullName: string; email: string };
    if (body.email === fx.user.email)
      return HttpResponse.json(
        { error: "Email đã được sử dụng." },
        { status: 409 },
      );
    return HttpResponse.json(
      { id: 99, fullName: body.fullName, email: body.email, role: "user" },
      { status: 201 },
    );
  }),

  http.get(`${API}/cities`, () => HttpResponse.json(fx.cities)),

  // Cổng thật cho lọc theo trường (`?cityId=`, `?cinemaId=`, `?movieId=`…) —
  // giữ đúng hành vi đó, không thì client lọc bằng URL mà server giả lờ đi.
  http.get(`${API}/cinemas`, ({ request }) => {
    const cityId = new URL(request.url).searchParams.get("cityId");
    return HttpResponse.json(
      cityId
        ? fx.cinemas.filter((c) => String(c.cityId) === cityId)
        : fx.cinemas,
    );
  }),
  http.get(`${API}/cinemas/:id`, ({ params }) =>
    found(byId(fx.cinemas, params.id as string)),
  ),

  http.get(`${API}/rooms`, ({ request }) => {
    const cinemaId = new URL(request.url).searchParams.get("cinemaId");
    return HttpResponse.json(
      cinemaId
        ? db.rooms.filter((r) => String(r.cinemaId) === cinemaId)
        : db.rooms,
    );
  }),
  http.get(`${API}/rooms/:id`, ({ params }) =>
    found(byId(db.rooms, params.id as string)),
  ),
  ...crudFor("rooms", () => db.rooms),

  http.get(`${API}/movies`, () => HttpResponse.json(db.movies)),
  http.get(`${API}/movies/:id`, ({ params }) =>
    found(byId(db.movies, params.id as string)),
  ),
  ...crudFor("movies", () => db.movies),

  http.get(`${API}/showtimes`, ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const movieId = sp.get("movieId");
    const roomId = sp.get("roomId");
    let list = db.showtimes;
    if (movieId) list = list.filter((s) => String(s.movieId) === movieId);
    if (roomId) list = list.filter((s) => String(s.roomId) === roomId);
    return HttpResponse.json(list);
  }),
  http.get(`${API}/showtimes/:id`, ({ params }) =>
    found(byId(db.showtimes, params.id as string)),
  ),
  ...crudFor("showtimes", () => db.showtimes),

  http.get(`${API}/concessions`, () => HttpResponse.json(fx.concessions)),

  http.get(`${API}/reviews`, ({ request }) => {
    const movieId = new URL(request.url).searchParams.get("movieId");
    return HttpResponse.json(
      movieId
        ? db.reviews.filter((r) => String(r.movieId) === movieId)
        : db.reviews,
    );
  }),
  // Cổng thật đóng dấu userId/userName/verified/createdAt phía server; ở đây
  // đóng dấu theo fx.user vì test đăng nhập bằng chính tài khoản đó.
  http.post(`${API}/reviews`, async ({ request }) => {
    const body = (await request.json()) as {
      movieId: number;
      rating: number;
      comment?: string;
    };
    const row: Review = {
      id: Math.max(0, ...db.reviews.map((r) => r.id)) + 1,
      movieId: body.movieId,
      userId: fx.user.id,
      userName: fx.user.fullName,
      rating: body.rating,
      comment: body.comment ?? "",
      verified: false,
      createdAt: new Date().toISOString(),
    };
    db.reviews.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  ...crudFor("reviews", () => db.reviews).slice(1), // POST ở trên đã có riêng

  // Cổng thật scope GET /bookings theo người gọi: user thấy vé của mình, admin
  // thấy tất cả. Bản giả trả cả bảng — fixture chỉ có vé của fx.user.
  http.get(`${API}/bookings`, () => HttpResponse.json(db.bookings)),
  http.post(`${API}/bookings`, async ({ request }) => {
    const body = (await request.json()) as Partial<Booking>;
    const row = {
      ...body,
      id: Math.max(0, ...db.bookings.map((b) => b.id)) + 1,
    } as Booking;
    db.bookings.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  ...crudFor("bookings", () => db.bookings).slice(1), // chỉ PATCH + DELETE

  // Giữ ghế: mặc định luôn thành công. Test xung đột đè handler này bằng
  // 409 + { conflicts } (đúng hình dạng server/src/api/holds.ts trả về).
  http.post(`${API}/holds`, () =>
    HttpResponse.json({ ok: true, expiresAt: Date.now() + 480_000 }),
  ),
  // Server thật trả 204 không thân (holds.ts) — giữ đúng để không xanh giả.
  http.delete(`${API}/holds`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API}/occupied-seats`, ({ request }) => {
    const showtimeId = new URL(request.url).searchParams.get("showtimeId");
    // Hình dạng PHẢI khớp server thật: { showtimeId, seats } — client đọc d.seats.
    return HttpResponse.json({ showtimeId, seats: ["A1", "A2"] });
  }),
  http.get(`${API}/payments/config`, () =>
    HttpResponse.json({ enabled: false, publishableKey: null }),
  ),
  http.get(`${API}/emails/config`, () => HttpResponse.json({ enabled: false })),
];
