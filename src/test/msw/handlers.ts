// Server giả ở tầng HTTP: test đi qua services/* và queries/* THẬT.
// URL khớp VITE_API_URL / VITE_AUTH_URL đã ghim trong vite.config.mjs.
import { http, HttpResponse } from "msw";
import type { Review } from "types";
import { fx } from "../fixtures";

const API = "http://localhost:4000/api";
const AUTH = "http://localhost:4000";

// Bảng `reviews` có ghi (trang chi tiết phim cho gửi/sửa/xoá), nên phải là bản
// sao có thể thay đổi + reset sau mỗi test (gọi trong src/test/setup.ts).
let reviews: Review[] = [];
export const resetFixtureDb = () => {
  reviews = fx.reviews.map((r) => ({ ...r }));
};
resetFixtureDb();

const byId = <T extends { id: number }>(rows: T[], raw: string | undefined) =>
  rows.find((r) => String(r.id) === raw);

const found = <T>(row: T | undefined) =>
  row
    ? HttpResponse.json(row)
    : HttpResponse.json({ error: "Not found" }, { status: 404 });

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
        ? fx.rooms.filter((r) => String(r.cinemaId) === cinemaId)
        : fx.rooms,
    );
  }),
  http.get(`${API}/rooms/:id`, ({ params }) =>
    found(byId(fx.rooms, params.id as string)),
  ),

  http.get(`${API}/movies`, () => HttpResponse.json(fx.movies)),
  http.get(`${API}/movies/:id`, ({ params }) =>
    found(byId(fx.movies, params.id as string)),
  ),

  http.get(`${API}/showtimes`, ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const movieId = sp.get("movieId");
    const roomId = sp.get("roomId");
    let list = fx.showtimes;
    if (movieId) list = list.filter((s) => String(s.movieId) === movieId);
    if (roomId) list = list.filter((s) => String(s.roomId) === roomId);
    return HttpResponse.json(list);
  }),
  http.get(`${API}/showtimes/:id`, ({ params }) =>
    found(byId(fx.showtimes, params.id as string)),
  ),

  http.get(`${API}/concessions`, () => HttpResponse.json(fx.concessions)),

  http.get(`${API}/reviews`, ({ request }) => {
    const movieId = new URL(request.url).searchParams.get("movieId");
    return HttpResponse.json(
      movieId ? reviews.filter((r) => String(r.movieId) === movieId) : reviews,
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
      id: Math.max(0, ...reviews.map((r) => r.id)) + 1,
      movieId: body.movieId,
      userId: fx.user.id,
      userName: fx.user.fullName,
      rating: body.rating,
      comment: body.comment ?? "",
      verified: false,
      createdAt: new Date().toISOString(),
    };
    reviews.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  http.patch(`${API}/reviews/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<Review>;
    const row = byId(reviews, params.id as string);
    if (!row) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    Object.assign(row, body);
    return HttpResponse.json(row);
  }),
  http.delete(`${API}/reviews/:id`, ({ params }) => {
    reviews = reviews.filter((r) => String(r.id) !== params.id);
    return HttpResponse.json({});
  }),

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
