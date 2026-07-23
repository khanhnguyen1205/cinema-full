import { Router } from "express";
import { handleRest } from "./repo";
import { getUserFromReq } from "../auth/middleware";
import { releaseHolds } from "./holds";

// Catalog: đọc công khai, ghi cần admin.
const PUBLIC_READ = new Set([
  "movies",
  "showtimes",
  "cinemas",
  "cities",
  "rooms",
  "concessions",
]);

export const gatewayRouter: Router = Router();

gatewayRouter.use(async (req, res) => {
  try {
    const rest = req.path.replace(/^\/+/, ""); // vd "movies/3" | "bookings"
    const collection = rest.split("/")[0];
    const isRead = req.method === "GET";
    const user = getUserFromReq(req);
    const isAdmin = user?.role === "admin";
    const deny = (code: number, msg: string): void => {
      res.status(code).json({ error: msg });
    };

    // users: chỉ admin (đang lộ email + hash nếu mở)
    if (collection === "users") {
      if (!isAdmin) {
        deny(403, "Không có quyền truy cập.");
        return;
      }
      await handleRest(req, res, rest);
      return;
    }

    // bookings: theo chủ sở hữu
    if (collection === "bookings") {
      if (isRead) {
        if (!user) {
          deny(401, "Vui lòng đăng nhập.");
          return;
        }
        if (isAdmin) {
          await handleRest(req, res, rest);
          return;
        }
        if (rest !== "bookings") {
          deny(403, "Không có quyền."); // chặn đọc đơn lẻ của người khác
          return;
        }
        await handleRest(req, res, rest, { userId: user.id }); // chỉ đơn của mình
        return;
      }
      if (req.method === "POST") {
        if (!user) {
          deny(401, "Vui lòng đăng nhập.");
          return;
        }
        req.body = { ...req.body, userId: user.id }; // ép userId = chính mình
        const stId = req.body.showtimeId;
        await handleRest(req, res, rest);
        if (stId != null) releaseHolds(stId, user.id); // đặt xong -> nhả hold của mình
        return;
      }
      if (!isAdmin) {
        deny(403, "Không có quyền."); // PATCH/DELETE
        return;
      }
      await handleRest(req, res, rest);
      return;
    }

    // catalog
    if (PUBLIC_READ.has(collection)) {
      if (isRead) {
        await handleRest(req, res, rest);
        return;
      }
      if (!isAdmin) {
        deny(403, "Không có quyền.");
        return;
      }
      await handleRest(req, res, rest);
      return;
    }

    deny(403, "Không có quyền."); // mặc định chặn
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});
