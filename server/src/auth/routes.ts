import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { normalizeEmail, safeUser } from "./helpers";
import { setAuthCookies, clearAuthCookies } from "./cookies";
import { verifyToken } from "./tokens";
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPassword,
} from "./users";

export const authRouter: Router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 10 lần đăng nhập SAI / IP / 15'
  skipSuccessfulRequests: true, // chỉ đếm login thất bại (đúng ý brute-force)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử. Vui lòng đợi rồi thử lại." },
});

authRouter.post("/register", async (req, res) => {
  try {
    const fullName = (req.body.fullName || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    if (!fullName || !email || !password) {
      res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
      return;
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ error: "Email này đã được đăng ký." });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await createUser({
      fullName,
      email,
      password: hash,
      role: "user",
    });
    setAuthCookies(res, user, false);
    res.status(201).json(safeUser(user));
  } catch {
    res.status(500).json({ error: "Đăng ký thất bại. Vui lòng thử lại." });
  }
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    const remember = !!req.body.remember;
    const user = await findUserByEmail(email);
    // Thông báo chung chung (không tiết lộ email có tồn tại hay không)
    if (!user || !user.password) {
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
      return;
    }
    // Hỗ trợ seed cũ (plaintext): so sánh thẳng rồi nâng cấp bcrypt.
    let ok: boolean;
    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = user.password === password;
      if (ok) {
        const hash = await bcrypt.hash(password, 10);
        await updateUserPassword(user.id, hash);
      }
    }
    if (!ok) {
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
      return;
    }
    setAuthCookies(res, user, remember);
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: "Đăng nhập thất bại. Vui lòng thử lại." });
  }
});

authRouter.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.rt as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Phiên đã hết hạn." });
      return;
    }
    const payload = verifyToken(token);
    const user = await findUserById(Number(payload.sub));
    if (!user) {
      res.status(401).json({ error: "Phiên đã hết hạn." });
      return;
    }
    setAuthCookies(res, user, !!payload.remember); // giữ chế độ ghi nhớ
    res.json(safeUser(user));
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: "Phiên đã hết hạn." });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.at as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Chưa đăng nhập." });
      return;
    }
    const payload = verifyToken(token);
    const user = await findUserById(Number(payload.sub));
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập." });
      return;
    }
    res.json(safeUser(user));
  } catch {
    res.status(401).json({ error: "Phiên truy cập đã hết hạn." });
  }
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});
