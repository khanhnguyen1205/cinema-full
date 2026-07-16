// Auth server (mock top-tier): bcrypt + JWT access/refresh trong cookie httpOnly.
// Danh tính tách khoi json-server data; user van luu o db.json qua json-server HTTP.
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
const JWT_SECRET = process.env.JWT_SECRET || "cinema-dev-secret-change-me";

const ACCESS_TTL = "15m";       // token truy cap ngan han
const REFRESH_TTL_DAYS = 7;     // han tuyet doi cua phien
const REFRESH_TTL = `${REFRESH_TTL_DAYS}d`;

const normalizeEmail = (e) => (e || "").trim().toLowerCase();
const safeUser = (u) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role || "user" });

// --- Cookie helpers ---------------------------------------------------------
const baseCookie = { httpOnly: true, sameSite: "lax", secure: false, path: "/" }; // secure:false vi localhost http

function setAuthCookies(res, user, remember) {
  const access = jwt.sign({ sub: user.id, role: user.role || "user" }, JWT_SECRET, { expiresIn: ACCESS_TTL });
  const refresh = jwt.sign({ sub: user.id, remember: !!remember }, JWT_SECRET, { expiresIn: REFRESH_TTL });
  // access: cookie phien (mat khi dong trinh duyet); JWT tu het han sau 15'
  res.cookie("at", access, { ...baseCookie });
  // refresh: neu "ghi nho" thi ben bi (maxAge), khong thi cookie phien
  res.cookie("rt", refresh, { ...baseCookie, ...(remember ? { maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 } : {}) });
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
  limit: 10, // 10 lan dang nhap sai / IP / 15'
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử. Vui lòng đợi rồi thử lại." },
});

app.post("/auth/register", async (req, res) => {
  try {
    const fullName = (req.body.fullName || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    if (!fullName || !email || !password) return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    if (password.length < 6) return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
    if (await findUserByEmail(email)) return res.status(409).json({ error: "Email này đã được đăng ký." });

    const hash = await bcrypt.hash(password, 10);
    const r = await fetch(`${DATA_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password: hash, role: "user" }),
    });
    const user = await r.json();
    setAuthCookies(res, user, false);
    res.status(201).json(safeUser(user));
  } catch (e) {
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
    const fail = () => res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
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
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: hash }),
        });
      }
    }
    if (!ok) return fail();

    setAuthCookies(res, user, remember);
    res.json(safeUser(user));
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
    res.status(401).json({ error: "Phiên truy cập đã hết hạn." });
  }
});

app.post("/auth/logout", (req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Auth server chạy tại http://localhost:${PORT} (data: ${DATA_URL}, web: ${WEB_ORIGIN})`);
});
