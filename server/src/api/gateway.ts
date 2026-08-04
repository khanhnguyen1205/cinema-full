import { Router } from "express";
import { handleRest } from "./repo";
import { getUserFromReq } from "../auth/middleware";
import { releaseHolds } from "./holds";
import { prisma } from "../db/prisma";
import { validateReviewInput, ownerOrAdmin } from "./reviews-validate";
import { settleCardPayment } from "../payments/settle";
import { sendTicketEmail } from "../email/send";
import { pickLang } from "../email/lang";
import { validateMovieImages } from "./movies-validate";

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
        if (!isAdmin && rest !== "bookings") {
          deny(403, "Không có quyền."); // chặn đọc đơn lẻ của người khác
          return;
        }
        // Admin thấy tất cả; người thường bị kẹp về đúng đơn của mình.
        const scope = isAdmin ? undefined : { userId: user.id };
        await handleRest(req, res, rest, scope);
        return;
      }
      if (req.method === "POST") {
        if (!user) {
          deny(401, "Vui lòng đăng nhập.");
          return;
        }
        const body = { ...req.body } as Record<string, unknown>;
        body.userId = user.id; // ép userId = chính mình
        const stId = body.showtimeId as string | number | undefined;

        if (body.paymentMethod === "card") {
          const paid = await settleCardPayment(body, user.id);
          if (!paid.ok) {
            res.status(paid.status).json({
              error: paid.error,
              ...(paid.conflicts ? { conflicts: paid.conflicts } : {}),
            });
            return;
          }
          if (paid.existing) {
            // Đã trả tiền và đơn đã tồn tại -> trả lại chính đơn đó, không tạo trùng.
            res.status(200).json(paid.existing);
            if (stId != null) releaseHolds(stId, user.id);
            return;
          }
          // Tiền ghi vào đơn là con số SERVER tự tính, không phải số client gửi.
          Object.assign(body, paid.totals);
        } else {
          delete body.paymentRef; // chỉ luồng thẻ mới được ghi mã giao dịch
        }

        req.body = body;
        const created = await handleRest(req, res, rest);
        if (stId != null) releaseHolds(stId, user.id); // đặt xong -> nhả hold của mình
        // Gửi vé qua email ở NỀN: đơn đã trả về client rồi (tiền cũng đã trừ), email
        // hỏng không được phép ảnh hưởng. sendTicketEmail không bao giờ throw.
        const newId = (created as { id?: number } | undefined)?.id;
        if (newId) void sendTicketEmail(newId, pickLang(req.headers["x-lang"]));
        return;
      }
      if (!isAdmin) {
        deny(403, "Không có quyền."); // PATCH/DELETE
        return;
      }
      await handleRest(req, res, rest);
      return;
    }

    // reviews: đọc công khai; tạo cần đăng nhập; sửa/xoá = chủ-hoặc-admin
    if (collection === "reviews") {
      if (isRead) {
        await handleRest(req, res, rest); // ?movieId= lọc qua filterable
        return;
      }
      if (!user) {
        deny(401, "Vui lòng đăng nhập.");
        return;
      }
      if (req.method === "POST") {
        const v = validateReviewInput(req.body ?? {});
        if (!v.ok) {
          deny(400, v.message);
          return;
        }
        const movieId = Number((req.body ?? {}).movieId);
        if (!Number.isFinite(movieId)) {
          deny(400, "Thiếu movieId hợp lệ.");
          return;
        }
        const movie = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!movie) {
          deny(404, "Phim không tồn tại.");
          return;
        }
        const bookedCount = await prisma.booking.count({
          where: { movieId, userId: user.id },
        });
        // ReqUser chỉ có {id, role} (JWT không mang tên) -> lấy fullName từ DB.
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        req.body = {
          movieId,
          rating: v.rating,
          comment: v.comment ?? null,
          userId: user.id,
          userName: dbUser?.fullName ?? "Người dùng",
          verified: bookedCount > 0,
          createdAt: new Date().toISOString(),
        };
        await handleRest(req, res, rest);
        return;
      }
      // PATCH / DELETE /reviews/:id
      const rid = Number(rest.split("/")[1]);
      if (!Number.isFinite(rid)) {
        deny(404, "Không tìm thấy.");
        return;
      }
      const existing = await prisma.review.findUnique({ where: { id: rid } });
      if (!existing) {
        deny(404, "Không tìm thấy đánh giá.");
        return;
      }
      if (!ownerOrAdmin(existing.userId, user)) {
        deny(403, "Không có quyền.");
        return;
      }
      if (req.method === "PATCH") {
        const v = validateReviewInput(req.body ?? {});
        if (!v.ok) {
          deny(400, v.message);
          return;
        }
        req.body = { rating: v.rating, comment: v.comment ?? null }; // chủ chỉ sửa rating/comment
      }
      await handleRest(req, res, rest);
      return;
    }

    // catalog: ai cũng đọc được, chỉ admin mới ghi
    if (PUBLIC_READ.has(collection)) {
      if (!isRead && !isAdmin) {
        deny(403, "Không có quyền.");
        return;
      }
      if (collection === "movies" && !isRead) {
        const v = validateMovieImages(req.body ?? {});
        if (!v.ok) {
          deny(400, v.message);
          return;
        }
      }
      await handleRest(req, res, rest);
      return;
    }

    deny(403, "Không có quyền."); // mặc định chặn
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});
