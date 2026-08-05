/**
 * Kiểm mọi URL ảnh trong tmdb.json rồi chọn ra 24 phim cuối cùng.
 *
 * Vẫn cần dù ảnh đã lấy từ chính trang TMDB: trang có thể nhúng một đường dẫn đã
 * dời kho, và một URL 404 nằm im trong db.json thì không ai biết cho tới lúc
 * người dùng mở trang phim. Rẻ hơn nhiều so với phát hiện muộn.
 *
 * Hạ cấp thay vì loại: backdrop hỏng thì đặt null (hero tự rơi về poster-làm-mờ,
 * xấu hơn nhưng không bao giờ vỡ). Chỉ loại phim khi POSTER hỏng.
 *
 * Chọn CÂN THEO THỂ LOẠI 3 phim/thể loại × 8 = 24, chứ không lấy 24 phim đầu
 * danh sách — nếu không bộ lọc thể loại lại lệch hẳn về Hành động.
 *
 * Chạy: npm run seed:verify-images
 */
import { readFileSync, writeFileSync } from "node:fs";

const PER_GENRE = 3;
const CONCURRENCY = 8;
const TIMEOUT_MS = 20000;

const tmdb = JSON.parse(
  readFileSync(new URL("./seed-data/tmdb.json", import.meta.url), "utf8"),
);

async function check(url) {
  if (!url) return { ok: false, status: 0, type: "khong co" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    // Không đọc body: chỉ cần status + kiểu nội dung.
    res.body?.cancel();
    const type = res.headers.get("content-type") || "";
    return {
      ok: res.status === 200 && type.startsWith("image/"),
      status: res.status,
      type,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      type: e.name === "AbortError" ? "timeout" : "loi mang",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const results = await mapLimit(tmdb.movies, CONCURRENCY, async (m) => ({
  movie: m,
  poster: await check(m.poster),
  backdrop: await check(m.backdrop),
}));

const usable = [];
let posterFail = 0;
let backdropFail = 0;

console.log("\nket qua kiem anh:\n");
for (const r of results) {
  const t = r.movie.title.padEnd(38).slice(0, 38);
  if (!r.poster.ok) {
    posterFail++;
    console.log(`  ✗ ${t} poster ${r.poster.status} ${r.poster.type} -> LOAI`);
    continue;
  }
  if (!r.backdrop.ok) {
    backdropFail++;
    console.log(
      `  ~ ${t} poster OK, backdrop ${r.backdrop.status} -> giu, backdrop=null`,
    );
    usable.push({ ...r.movie, backdrop: null });
  } else {
    usable.push({ ...r.movie });
  }
}

console.log(
  `\ntong ${tmdb.movies.length} · dung duoc ${usable.length} (thieu backdrop ${backdropFail}) · loai ${posterFail}`,
);

// Cân theo thể loại.
const byGenre = new Map();
for (const m of usable) {
  if (!byGenre.has(m.genre)) byGenre.set(m.genre, []);
  byGenre.get(m.genre).push(m);
}
const chosen = [];
const thin = [];
for (const [genre, list] of [...byGenre.entries()].sort()) {
  if (list.length < PER_GENRE) thin.push(`${genre} chi co ${list.length}`);
  chosen.push(...list.slice(0, PER_GENRE));
}

console.log("\nchon can theo the loai:");
for (const [genre, list] of [...byGenre.entries()].sort()) {
  console.log(
    `  ${genre.padEnd(11)} ${Math.min(list.length, PER_GENRE)}/${list.length}`,
  );
}

if (chosen.length < 24) {
  console.error(
    `\n❌ Chi chon duoc ${chosen.length}/24 phim. ${thin.join(", ")}. Bo sung MOVIE_POOL roi chay lai seed:fetch-tmdb.`,
  );
  process.exitCode = 1;
} else {
  writeFileSync(
    new URL("./seed-data/images.verified.json", import.meta.url),
    JSON.stringify(
      { verifiedAt: new Date().toISOString(), movies: chosen },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `\n✅ Da ghi ${chosen.length} phim vao scripts/seed-data/images.verified.json`,
  );
}
