// Auth server (mock top-tier): bcrypt + JWT access/refresh trong cookie httpOnly.
// Danh tính tách khoi json-server data; user van luu o db.json qua json-server HTTP.
require("dotenv").config(); // nap .env truoc khi doc process.env
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const PORT = process.env.AUTH_PORT || 4000;
const DATA_URL = process.env.DATA_URL || "http://localhost:9999"; // json-server
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
// Dev only: giu bi mat trong env o production. Doi secret => moi phien cu het hieu luc.
const DEFAULT_SECRET = "cinema-dev-secret-change-me";
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
if (JWT_SECRET === DEFAULT_SECRET) {
  const msg =
    "[auth] Dang dung JWT_SECRET mac dinh — chi chap nhan khi dev. Dat JWT_SECRET trong .env cho production.";
  if (process.env.NODE_ENV === "production") throw new Error(msg);
  console.warn(msg);
}

const ACCESS_TTL = "15m"; // token truy cap ngan han
const REFRESH_TTL_DAYS = 7; // han tuyet doi cua phien
const REFRESH_TTL = `${REFRESH_TTL_DAYS}d`;

const normalizeEmail = (e) => (e || "").trim().toLowerCase();
const safeUser = (u) => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role || "user",
});

// Doc user tu access cookie (khong nem loi neu thieu/het han -> tra null)
function getUserFromReq(req) {
  const t = req.cookies.at;
  if (!t) return null;
  try {
    const p = jwt.verify(t, JWT_SECRET);
    return { id: p.sub, role: p.role };
  } catch {
    return null;
  }
}

// --- Cookie helpers ---------------------------------------------------------
const baseCookie = {
  httpOnly: true,
  sameSite: "lax",
  secure: false,
  path: "/",
}; // secure:false vi localhost http

function setAuthCookies(res, user, remember) {
  const access = jwt.sign(
    { sub: user.id, role: user.role || "user" },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );
  const refresh = jwt.sign({ sub: user.id, remember: !!remember }, JWT_SECRET, {
    expiresIn: REFRESH_TTL,
  });
  // access: cookie phien (mat khi dong trinh duyet); JWT tu het han sau 15'
  res.cookie("at", access, { ...baseCookie });
  // refresh: neu "ghi nho" thi ben bi (maxAge), khong thi cookie phien
  res.cookie("rt", refresh, {
    ...baseCookie,
    ...(remember ? { maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 } : {}),
  });
}

function clearAuthCookies(res) {
  res.clearCookie("at", baseCookie);
  res.clearCookie("rt", baseCookie);
}

// --- json-server user access ------------------------------------------------
async function findUserByEmail(email) {
  const r = await fetch(`${DATA_URL}/users?email=${encodeURIComponent(email)}`);
  const list = await r.json();
  return list[0] || null;
}
async function findUserById(id) {
  const r = await fetch(`${DATA_URL}/users/${id}`);
  if (!r.ok) return null;
  return r.json();
}

// --- App --------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 10 lan dang nhap SAI / IP / 15'
  skipSuccessfulRequests: true, // chi dem login that bai (dung y brute-force)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử. Vui lòng đợi rồi thử lại." },
});

app.post("/auth/register", async (req, res) => {
  try {
    const fullName = (req.body.fullName || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    if (!fullName || !email || !password)
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
    if (await findUserByEmail(email))
      return res.status(409).json({ error: "Email này đã được đăng ký." });

    const hash = await bcrypt.hash(password, 10);
    const r = await fetch(`${DATA_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password: hash, role: "user" }),
    });
    const user = await r.json();
    setAuthCookies(res, user, false);
    res.status(201).json(safeUser(user));
  } catch {
    res.status(500).json({ error: "Đăng ký thất bại. Vui lòng thử lại." });
  }
});

app.post("/auth/login", loginLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    const remember = !!req.body.remember;
    const user = await findUserByEmail(email);
    // Thong bao chung chung (khong tiet lo email co ton tai hay khong)
    const fail = () =>
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
    if (!user || !user.password) return fail();

    // Ho tro user seed cu (plaintext) lan cai dat dau: neu chua bcrypt thi so sanh thang roi nang cap.
    let ok;
    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = user.password === password;
      if (ok) {
        const hash = await bcrypt.hash(password, 10);
        await fetch(`${DATA_URL}/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: hash }),
        });
      }
    }
    if (!ok) return fail();

    setAuthCookies(res, user, remember);
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: "Đăng nhập thất bại. Vui lòng thử lại." });
  }
});

app.post("/auth/refresh", async (req, res) => {
  try {
    const token = req.cookies.rt;
    if (!token) return res.status(401).json({ error: "Phiên đã hết hạn." });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: "Phiên đã hết hạn." });
    setAuthCookies(res, user, payload.remember); // cap access moi, giu che do ghi nho
    res.json(safeUser(user));
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: "Phiên đã hết hạn." });
  }
});

app.get("/auth/me", async (req, res) => {
  try {
    const token = req.cookies.at;
    if (!token) return res.status(401).json({ error: "Chưa đăng nhập." });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: "Chưa đăng nhập." });
    res.json(safeUser(user));
  } catch {
    res.status(401).json({ error: "Phiên truy cập đã hết hạn." });
  }
});

app.post("/auth/logout", (req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});

// ============================================================================
// DATA GATEWAY: cong co phan quyen dat truoc json-server (:9999 la noi bo).
// Client goi :4000/api/* thay vi :9999/* truc tiep.
// ============================================================================

// Chuyen tiep request sang json-server, giu query + body + status + header can thiet.
async function forward(req, res, rest, extraQuery) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) params.set(k, v);
  if (extraQuery)
    for (const [k, v] of Object.entries(extraQuery)) params.set(k, String(v));
  const qs = params.toString();
  const url = `${DATA_URL}/${rest}${qs ? `?${qs}` : ""}`;
  const init = { method: req.method, headers: {} };
  if (!["GET", "HEAD", "DELETE"].includes(req.method)) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(req.body || {});
  }
  const r = await fetch(url, init);
  const body = await r.text();
  res.status(r.status);
  const ct = r.headers.get("content-type");
  if (ct) res.set("Content-Type", ct);
  const xtc = r.headers.get("x-total-count");
  if (xtc) res.set("X-Total-Count", xtc);
  return res.send(body);
}

// ============================================================================
// GIỮ GHẾ (in-memory): hold sống trong RAM cổng :4000, tự hết hạn sau TTL.
// Cấu trúc: Map<showtimeId(string), Map<seatNumber, { userId, expiresAt }>>.
// Mất khi restart server — chấp nhận được cho đồ án, không đụng db.json.
// ============================================================================
const HOLD_TTL_MS = 8 * 60 * 1000; // 8 phút — khớp đồng hồ giữ ghế phía client

const holds = new Map();

// Lấy map ghế của 1 suat sau khi don sach cac hold het han (tao neu chua co).
function seatHolds(showtimeId) {
  const key = String(showtimeId);
  let m = holds.get(key);
  if (!m) {
    m = new Map();
    holds.set(key, m);
  }
  const now = Date.now();
  for (const [seat, h] of m) if (h.expiresAt <= now) m.delete(seat);
  return m;
}

// Ghe dang bi NGUOI KHAC (khac userId) giu o 1 suat.
function heldByOthers(showtimeId, userId) {
  const out = [];
  for (const [seat, h] of seatHolds(showtimeId))
    if (h.userId !== userId) out.push(seat);
  return out;
}

// Dat lai toan bo ghe user giu o suat = danh sach seats, gia han TTL (kiem heartbeat).
function setHolds(showtimeId, userId, seats) {
  const m = seatHolds(showtimeId);
  for (const [seat, h] of m) if (h.userId === userId) m.delete(seat);
  const expiresAt = Date.now() + HOLD_TTL_MS;
  seats.forEach((s) => m.set(s, { userId, expiresAt }));
  return expiresAt;
}

// Nha toan bo hold cua user o 1 suat.
function releaseHolds(showtimeId, userId) {
  const m = seatHolds(showtimeId);
  for (const [seat, h] of m) if (h.userId === userId) m.delete(seat);
}

// Ghe da dat cua 1 suat: ghe da ban (booking + showtime.bookedSeats) + ghe NGUOI KHAC dang giu.
// Chi tra so ghe, KHONG kem thong tin ca nhan cua don.
app.get("/api/occupied-seats", async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Vui lòng đăng nhập." });
  const showtimeId = req.query.showtimeId;
  if (!showtimeId) return res.status(400).json({ error: "Thiếu showtimeId." });
  try {
    const [bookings, stRes] = await Promise.all([
      fetch(`${DATA_URL}/bookings`).then((r) => r.json()),
      fetch(`${DATA_URL}/showtimes/${showtimeId}`),
    ]);
    const showtime = stRes.ok ? await stRes.json() : null;
    const set = new Set(showtime?.bookedSeats || []);
    bookings
      .filter((b) => String(b.showtimeId) === String(showtimeId))
      .forEach((b) => (b.seats || []).forEach((s) => set.add(s)));
    heldByOthers(showtimeId, user.id).forEach((s) => set.add(s)); // ghe nguoi khac dang giu
    res.json({ showtimeId: Number(showtimeId), seats: [...set] });
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});

// Giu ghe: dat/gia han danh sach ghe user dang chon cho 1 suat (kiem heartbeat).
app.post("/api/holds", (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Vui lòng đăng nhập." });
  const showtimeId = req.body.showtimeId;
  const seats = Array.isArray(req.body.seats) ? req.body.seats : [];
  if (!showtimeId) return res.status(400).json({ error: "Thiếu showtimeId." });
  const others = new Set(heldByOthers(showtimeId, user.id));
  const conflicts = seats.filter((s) => others.has(s));
  if (conflicts.length)
    return res
      .status(409)
      .json({ error: "Ghế vừa bị người khác giữ.", conflicts });
  const expiresAt = setHolds(showtimeId, user.id, seats);
  res.json({ ok: true, expiresAt });
});

// Nha ghe dang giu cua user cho 1 suat.
app.delete("/api/holds", (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Vui lòng đăng nhập." });
  const showtimeId = req.query.showtimeId;
  if (!showtimeId) return res.status(400).json({ error: "Thiếu showtimeId." });
  releaseHolds(showtimeId, user.id);
  res.status(204).end();
});

// Catalog: doc cong khai, ghi can admin.
const PUBLIC_READ = new Set([
  "movies",
  "showtimes",
  "cinemas",
  "cities",
  "rooms",
  "concessions",
]);

app.use("/api", async (req, res) => {
  try {
    const rest = req.path.replace(/^\/+/, ""); // vd "movies/3" | "bookings"
    const collection = rest.split("/")[0];
    const isRead = req.method === "GET";
    const user = getUserFromReq(req);
    const isAdmin = user?.role === "admin";
    const deny = (code, msg) => res.status(code).json({ error: msg });

    // users: chi admin (dang lo email + hash neu mo)
    if (collection === "users") {
      if (!isAdmin) return deny(403, "Không có quyền truy cập.");
      return forward(req, res, rest);
    }

    // bookings: theo chu so huu
    if (collection === "bookings") {
      if (isRead) {
        if (!user) return deny(401, "Vui lòng đăng nhập.");
        if (isAdmin) return forward(req, res, rest);
        if (rest !== "bookings") return deny(403, "Không có quyền."); // chan doc don le cua nguoi khac
        return forward(req, res, rest, { userId: user.id }); // chi don cua minh
      }
      if (req.method === "POST") {
        if (!user) return deny(401, "Vui lòng đăng nhập.");
        req.body = { ...req.body, userId: user.id }; // ep userId = chinh minh
        const stId = req.body.showtimeId;
        const out = await forward(req, res, rest);
        if (stId != null) releaseHolds(stId, user.id); // dat xong -> nha hold cua minh
        return out;
      }
      if (!isAdmin) return deny(403, "Không có quyền."); // PATCH/DELETE
      return forward(req, res, rest);
    }

    // catalog
    if (PUBLIC_READ.has(collection)) {
      if (isRead) return forward(req, res, rest);
      if (!isAdmin) return deny(403, "Không có quyền.");
      return forward(req, res, rest);
    }

    return deny(403, "Không có quyền."); // mac dinh chan
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});

app.listen(PORT, () => {
  console.log(
    `Auth server chạy tại http://localhost:${PORT} (data: ${DATA_URL}, web: ${WEB_ORIGIN})`,
  );
});
