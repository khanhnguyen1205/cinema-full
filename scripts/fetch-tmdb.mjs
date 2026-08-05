/**
 * Tra poster / backdrop / điểm / thời lượng từ trang phim CÔNG KHAI của TMDB.
 *
 * VÌ SAO PHẢI TRA: đường dẫn ảnh TMDB là chuỗi băm
 * (/uiNPl4ONkYC1a0hGzIFLZSGST3O.jpg), không suy ra được từ tên phim. Gõ tay là
 * đoán — và đoán sai kiểu tệ nhất không phải 404 mà là 200 của phim khác, thứ
 * chỉ người nhìn mới phát hiện. Lấy hash từ CHÍNH trang của phim đó thì không
 * còn cửa cho nhầm lẫn ấy. Cùng cách commit 1770893 đã dùng cho 16 phim cũ.
 *
 * Không cần API key. Đổi lại phải lịch sự với một trang web công cộng: tuần tự,
 * 2 request mỗi phim, có nghỉ giữa các lần.
 *
 * Chạy: npm run seed:fetch-tmdb
 */
import { writeFileSync } from "node:fs";
import { MOVIE_POOL } from "./seed-data/movies.mjs";

const UA = "Mozilla/5.0 (compatible; cinema-full-seed/1.0)";
const DELAY_MS = 350;
const TIMEOUT_MS = 25000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Kho ảnh dọc (poster) và ngang (backdrop) mà trang TMDB thực sự nhúng. Lấy phần
// băm rồi dựng lại ở kho repo đang dùng: /w500/ cho poster, /w1280/ cho backdrop.
const POSTER_BUCKETS =
  /\/t\/p\/(?:w600_and_h900_face|w300_and_h450_face|w600_and_h900_bestv2|w300_and_h450_bestv2)\/([A-Za-z0-9]{20,}\.(?:jpg|png))/;
const BACKDROP_BUCKETS =
  /\/t\/p\/(?:w1066_and_h600_face|w533_and_h300_face|original|w1280)\/([A-Za-z0-9]{20,}\.(?:jpg|png))/;

function firstMatch(html, re) {
  const m = re.exec(html);
  return m ? m[1] : null;
}

function parseRuntime(html) {
  const m = /class="runtime">([\s\S]*?)<\/span>/.exec(html);
  if (!m) return null;
  const text = m[1].replace(/\s+/g, " ").trim();
  const h = /(\d+)\s*h/.exec(text);
  const min = /(\d+)\s*m/.exec(text);
  const total = (h ? +h[1] * 60 : 0) + (min ? +min[1] : 0);
  return total > 0 ? total : null;
}

function parseRating(html) {
  const m = /data-percent="([0-9.]+)"/.exec(html);
  if (!m) return null;
  const r = Math.round((+m[1] / 10) * 10) / 10;
  return r > 0 ? r : null;
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Kết quả ĐẦU TIÊN không phải lúc nào cũng đúng phim, và sai kiểu này im lặng:
// "Your Name." từng khớp sang "Call Me by Your Name" — hai phim trong catalogue
// sẽ đeo y hệt một bộ ảnh mà nhìn qua vẫn thấy "ảnh đúng một phim nào đó".
// "Spirited Away" thì khớp sang "Uncovering Spirited Away", phim tài liệu 24 phút.
// Nên phải ĐỐI CHIẾU slug với tên phim, và thà báo lỗi còn hơn nhận nhầm.
function matchSlug(html, title) {
  const want = norm(title);
  const seen = new Set();
  for (const m of html.matchAll(/\/movie\/(\d+-[a-z0-9-]+)/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const slug = norm(m[1].replace(/^\d+-/, ""));
    // Khớp hai chiều: slug của TMDB có thể ngắn hơn (bỏ dấu câu) hoặc dài hơn
    // (thêm năm phát hành) tên mình ghi.
    if (slug === want || slug.startsWith(want) || want.startsWith(slug)) {
      return m[1];
    }
  }
  return null;
}

async function lookup(movie) {
  let slug;
  let search = "";

  if (movie.tmdbId) {
    // Ghim tay: dùng cho phim mà TÌM KIẾM bó tay. Phim Nhật là ca điển hình —
    // TMDB đặt slug theo tên gốc ("sen-to-chihiro-no-kamikakushi") nên tìm bằng
    // tên tiếng Anh không ra, và trang kết quả toàn phim ăn theo cùng tên.
    slug = String(movie.tmdbId);
  } else {
    search = await getText(
      `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(movie.title)}`,
    );
    if (!search) return { ...movie, error: "khong tai duoc trang tim kiem" };
    slug = matchSlug(search, movie.title);
    if (!slug) return { ...movie, error: "khong ket qua nao khop ten phim" };
    await sleep(DELAY_MS);
  }

  const page = await getText(`https://www.themoviedb.org/movie/${slug}`);
  if (!page) return { ...movie, error: "khong tai duoc trang phim" };

  const poster =
    firstMatch(page, POSTER_BUCKETS) ?? firstMatch(search, POSTER_BUCKETS);
  const backdrop = firstMatch(page, BACKDROP_BUCKETS);
  if (!poster) return { ...movie, error: "khong tim thay poster" };

  const duration = parseRuntime(page) ?? 120;
  // Phim chiếu rạp dưới 80 phút hầu như luôn là dấu hiệu khớp nhầm sang phim
  // tài liệu / phim ngắn cùng tên.
  if (duration < 80 || duration > 240) {
    return {
      ...movie,
      error: `thoi luong vo ly (${duration}p) — nhieu kha nang khop nham`,
    };
  }

  return {
    title: movie.title,
    genre: movie.genre,
    description: movie.description,
    tmdb: slug,
    poster: `https://image.tmdb.org/t/p/w500/${poster}`,
    backdrop: backdrop ? `https://image.tmdb.org/t/p/w1280/${backdrop}` : null,
    rating: parseRating(page) ?? 7.5,
    duration,
  };
}

const out = [];
const failed = [];

console.log(`\nTra ${MOVIE_POOL.length} phim tren themoviedb.org...\n`);
for (const m of MOVIE_POOL) {
  const r = await lookup(m);
  const label = m.title.padEnd(38).slice(0, 38);
  if (r.error) {
    failed.push(`${m.title} — ${r.error}`);
    console.log(`  ✗ ${label} ${r.error}`);
  } else {
    out.push(r);
    console.log(
      `  ✓ ${label} ${String(r.rating).padEnd(4)} ${String(r.duration).padStart(3)}p ${r.backdrop ? "bd" : "--"}`,
    );
  }
  await sleep(DELAY_MS);
}

console.log(`\ntra duoc ${out.length}/${MOVIE_POOL.length}`);
if (failed.length) {
  console.log("that bai:");
  failed.forEach((f) => console.log(`  ${f}`));
}

writeFileSync(
  new URL("./seed-data/tmdb.json", import.meta.url),
  JSON.stringify(
    { fetchedAt: new Date().toISOString(), movies: out },
    null,
    2,
  ) + "\n",
);
console.log(`\n✅ Da ghi ${out.length} phim vao scripts/seed-data/tmdb.json`);
