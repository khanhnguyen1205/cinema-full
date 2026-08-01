// Đo Lighthouse trên bản build PRODUCTION đang chạy (không phải dev server:
// dev server không minify, không nén, số đo sẽ vô nghĩa).
//
//   npm run build
//   NODE_ENV=production PORT=4100 JWT_SECRET=... npm run start:prod   # cửa sổ khác
//   node scripts/lighthouse.mjs
//
// Dùng Chromium của Playwright (đã có sẵn cho e2e) nên không phải cài thêm
// trình duyệt. Báo cáo JSON ghi ra lighthouse-*.json và KHÔNG commit.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = process.env.LH_BASE ?? "http://localhost:4100";
// Chỉ trang công khai: Lighthouse chạy không có cookie phiên nên trang admin và
// trang vé sẽ bị đá về /login và cho ra con số vô nghĩa.
const ROUTES = ["/", "/movies", "/movie/1", "/cinemas"];
const CATS = ["performance", "accessibility", "best-practices", "seo"];

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
// Windows: spawn một file .cmd đòi shell, không thì EINVAL (Node ≥20).
const shell = process.platform === "win32";
const nameOf = (route) => (route === "/" ? "root" : route.replace(/\W+/g, "_"));
const rows = [];

for (const route of ROUTES) {
  const file = `lighthouse-${nameOf(route)}.json`;
  execFileSync(
    npx,
    [
      "lighthouse",
      `${BASE}${route}`,
      "--quiet",
      "--output=json",
      `--output-path=${file}`,
      // Một cờ duy nhất, KHÔNG có khoảng trắng: qua shell của Windows, chuỗi
      // có dấu cách bị tách thành hai tham số và lighthouse hiểu sai.
      "--chrome-flags=--headless=new",
    ],
    {
      stdio: "inherit",
      shell,
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
    },
  );
  const report = JSON.parse(readFileSync(file, "utf8"));
  rows.push([
    route,
    ...CATS.map((c) => Math.round((report.categories[c]?.score ?? 0) * 100)),
  ]);
}

// In ra dạng bảng markdown để dán thẳng vào docs.
console.log("\n| Trang | Hiệu năng | Trợ năng | Thực hành tốt | SEO |");
console.log("| ----- | --------- | -------- | ------------- | --- |");
for (const r of rows)
  console.log(`| \`${r[0]}\` | ${r.slice(1).join(" | ")} |`);

// Gợi ý sửa: liệt kê các mục Lighthouse chấm trượt, kèm mức tiết kiệm.
const last = JSON.parse(
  readFileSync(`lighthouse-${nameOf(ROUTES[0])}.json`, "utf8"),
);
const fails = Object.values(last.audits)
  .filter(
    (a) =>
      a.score !== null &&
      a.score < 0.9 &&
      a.scoreDisplayMode !== "notApplicable",
  )
  .map(
    (a) =>
      `  • ${a.id}: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ""}`,
  );
console.log(`\nMục chưa đạt ở trang chủ:\n${fails.join("\n")}`);
