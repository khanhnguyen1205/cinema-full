// Thuần — KHÔNG import Prisma/env (test chạy không cần DB).
export type ReviewInput =
  | { ok: true; rating: number; comment?: string }
  | { ok: false; message: string };

export function validateReviewInput(body: {
  rating?: unknown;
  comment?: unknown;
}): ReviewInput {
  const rating = body.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return { ok: false, message: "Điểm đánh giá phải từ 1 đến 5 sao." };
  }
  let comment: string | undefined;
  if (body.comment != null) {
    if (typeof body.comment !== "string") {
      return { ok: false, message: "Bình luận không hợp lệ." };
    }
    const trimmed = body.comment.trim();
    if (trimmed.length > 500) {
      return { ok: false, message: "Bình luận tối đa 500 ký tự." };
    }
    if (trimmed.length > 0) comment = trimmed;
  }
  return comment === undefined
    ? { ok: true, rating }
    : { ok: true, rating, comment };
}

export function ownerOrAdmin(
  reviewUserId: number,
  user: { id: number; role: string } | null,
): boolean {
  if (!user) return false;
  return user.role === "admin" || user.id === reviewUserId;
}
