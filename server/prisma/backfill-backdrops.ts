/**
 * Điền `Movie.backdrop` cho những phim đang trống, lấy giá trị từ db.json.
 *
 * KHÔNG phải seed. `prisma:seed` xoá sạch mọi bảng rồi nạp lại — chạy nó trên
 * production là mất hết phim admin đã thêm và mất hết vé khách đã đặt. Script
 * này chỉ chạm đúng MỘT cột của những dòng đã có, nên chạy được trên DB thật.
 *
 * Ba lớp an toàn:
 *  1. Mặc định chỉ IN RA dự định. Phải thêm `--apply` mới thực sự ghi.
 *  2. Chỉ ghi khi backdrop hiện đang trống — không bao giờ đè lên ảnh admin
 *     đã tự chọn.
 *  3. Chỉ ghi khi TÊN PHIM trong DB khớp db.json. Admin có thể đã sửa phim id 3
 *     thành một phim khác hẳn; thiếu chốt này là dán ảnh Dune lên Frozen.
 *
 * Chạy: npm run backfill:backdrops -- --apply
 */
import { PrismaClient } from "@prisma/client";
import db from "../../db.json";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type SeedMovie = { id: number; title: string; backdrop?: string };

async function main() {
  const seeded = (db.movies as SeedMovie[]).filter((m) => m.backdrop);
  const rows = await prisma.movie.findMany({
    where: { id: { in: seeded.map((m) => m.id) } },
    select: { id: true, title: true, backdrop: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const todo: { id: number; title: string; backdrop: string }[] = [];
  const skipped: string[] = [];

  for (const m of seeded) {
    const row = byId.get(m.id);
    if (!row) {
      skipped.push(`#${m.id} ${m.title} — không còn trong DB`);
    } else if (row.backdrop) {
      skipped.push(`#${m.id} ${row.title} — đã có ảnh nền, giữ nguyên`);
    } else if (row.title !== m.title) {
      skipped.push(
        `#${m.id} DB đang là "${row.title}" chứ không phải "${m.title}" — bỏ qua`,
      );
    } else {
      todo.push({ id: m.id, title: m.title, backdrop: m.backdrop! });
    }
  }

  console.log(`\nSẽ điền ảnh nền cho ${todo.length} phim:`);
  todo.forEach((t) =>
    console.log(`  #${t.id} ${t.title}\n      ${t.backdrop}`),
  );
  if (skipped.length) {
    console.log(`\nBỏ qua ${skipped.length}:`);
    skipped.forEach((s) => console.log(`  ${s}`));
  }

  if (!APPLY) {
    console.log(
      "\n(chưa ghi gì — chạy lại kèm `-- --apply` nếu danh sách trên đúng)",
    );
    return;
  }

  for (const t of todo) {
    await prisma.movie.update({
      where: { id: t.id },
      data: { backdrop: t.backdrop },
    });
  }
  console.log(`\n✅ Đã cập nhật ${todo.length} phim.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
