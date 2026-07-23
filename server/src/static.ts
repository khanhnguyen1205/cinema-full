import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";

// Mọi đường dẫn KHÔNG bắt đầu bằng /api hoặc /auth (đúng đoạn đầu) đều là route SPA.
// "/apixel" vẫn là route SPA — vì thế cần (?:/|$) chứ không chỉ (?!api).
export const spaFallbackPattern = /^\/(?!api(?:\/|$)|auth(?:\/|$)).*$/;

// CỐ Ý không import ./env: env.ts throw khi thiếu DATABASE_URL, mà file này có
// unit test chạy trong CI (job checks) — nơi không có database.
// Ở production, chính server này phục vụ luôn SPA đã build => cùng origin,
// cookie SameSite=Lax hoạt động bình thường, không cần CORS.
export function mountStatic(app: Express): void {
  if (process.env.NODE_ENV !== "production") return;
  const buildDir = path.resolve(process.cwd(), "build");
  const indexHtml = path.join(buildDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.warn(
      `[server] Không thấy ${indexHtml} — bỏ qua phục vụ SPA. Chạy "npm run build" trước.`,
    );
    return;
  }
  app.use(express.static(buildDir));
  // Fallback: mọi route SPA trả index.html để React Router tự điều hướng.
  app.get(spaFallbackPattern, (_req, res) => {
    res.sendFile(indexHtml);
  });
  console.log(`[server] Phục vụ SPA từ ${buildDir}`);
}
