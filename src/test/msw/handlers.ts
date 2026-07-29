// Server giả ở tầng HTTP: test đi qua services/* và queries/* THẬT.
// URL khớp VITE_API_URL / VITE_AUTH_URL đã ghim trong vite.config.mjs.
import { http, HttpResponse } from "msw";
import { fx } from "../fixtures";

const API = "http://localhost:4000/api";
const AUTH = "http://localhost:4000";

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
  http.get(`${API}/cinemas`, () => HttpResponse.json(fx.cinemas)),
  http.get(`${API}/rooms`, () => HttpResponse.json(fx.rooms)),
  http.get(`${API}/movies`, () => HttpResponse.json(fx.movies)),
  http.get(`${API}/showtimes`, () => HttpResponse.json(fx.showtimes)),
  http.get(`${API}/concessions`, () => HttpResponse.json(fx.concessions)),
  http.get(`${API}/reviews`, () => HttpResponse.json(fx.reviews)),
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
