import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Dựng icon PWA "C" đỏ Anton trên nền gần-đen bằng headless Chrome.
// Chạy 1 lần: `node scripts/gen-icons.mjs` -> ghi các PNG vào public/.
const root = fileURLToPath(new URL("..", import.meta.url));
const woff2 = readFileSync(
  root + "node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2",
).toString("base64");

// letterScale: cỡ chữ so với cạnh; border: viền đỏ inset (tắt cho maskable).
function html({ size, letterScale, border }) {
  const inset = Math.round(size * 0.06);
  const bw = border ? Math.max(2, Math.round(size * 0.015)) : 0;
  const radius = Math.round(size * 0.04);
  const fontSize = Math.round(size * letterScale);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:'Anton';src:url(data:font/woff2;base64,${woff2}) format('woff2');}
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:${size}px;height:${size}px;}
    .box{width:${size}px;height:${size}px;background:#0a0a0a;display:flex;align-items:center;justify-content:center;position:relative;}
    .box::before{content:"";position:absolute;inset:${inset}px;border:${bw}px solid #e63030;border-radius:${radius}px;}
    .c{font-family:'Anton',sans-serif;color:#e63030;font-size:${fontSize}px;line-height:1;position:relative;}
  </style></head><body><div class="box"><span class="c">C</span></div></body></html>`;
}

const targets = [
  { file: "icon-192.png", size: 192, letterScale: 0.78, border: true },
  { file: "icon-512.png", size: 512, letterScale: 0.78, border: true },
  { file: "icon-512-maskable.png", size: 512, letterScale: 0.6, border: false },
  { file: "apple-touch-icon.png", size: 180, letterScale: 0.78, border: true },
  { file: "favicon-32.png", size: 32, letterScale: 0.82, border: false },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(html(t), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({
    clip: { x: 0, y: 0, width: t.size, height: t.size },
    omitBackground: false,
  });
  writeFileSync(root + "public/" + t.file, buf);
  console.log("wrote public/" + t.file);
}
await browser.close();
