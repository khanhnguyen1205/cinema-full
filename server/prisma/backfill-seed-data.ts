/**
 * Chèn dữ liệu mới từ db.json vào một DB ĐANG CHẠY, không xoá gì.
 *
 * KHÔNG phải seed. `prisma:seed` gọi clearAll() chạy DELETE FROM từng bảng —
 * chạy trên production là mất hết phim admin đã thêm và mất hết vé khách đã đặt.
 *
 * Ba khác biệt cốt lõi so với seed.ts:
 *  1. Chỉ INSERT. Không DELETE, không UPDATE.
 *  2. KHÔNG ép id. Production có thể đã có phim admin thêm chiếm id 17+; ép id
 *     là đụng ngay. Để Postgres tự cấp rồi ánh xạ lại FK theo id THẬT vừa nhận —
 *     đó là lý do phải đi tuần tự City → Cinema → Room → Showtime chứ không
 *     createMany một phát.
 *  3. Khớp theo KHOÁ TỰ NHIÊN (tên phim / tên+địa chỉ rạp / email user /
 *     (phòng, giờ)) nên chạy hai lần không nhân đôi.
 *
 * Booking và Review cố ý KHÔNG chèn: đơn hàng và đánh giá chỉ có nghĩa khi là
 * của người thật. Production đầy catalogue là đủ.
 *
 * Chạy: npm run backfill:seed-data            (chỉ in dự định)
 *       npm run backfill:seed-data -- --apply (thực sự ghi)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import db from "../../db.json";
import { addDays, dayOf, offsetDaysFor } from "../src/schedule/date-shift";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Cùng phép dịch ngày như seed.ts: db.json giữ ngày cứng, phải đẩy về quanh hôm
// nay thì suất chiếu mới đặt được.
const TODAY = new Date().toISOString().slice(0, 10);
const EARLIEST = db.showtimes.map((s) => dayOf(s.time)).sort()[0] ?? TODAY;
const OFFSET = offsetDaysFor(EARLIEST, TODAY);
const shift = (iso: string): string => addDays(iso, OFFSET);

const norm = (s: string) => s.trim().toLowerCase();
const cinemaKey = (name: string, address: string) =>
  `${norm(name)}|${norm(address)}`;
const roomKey = (cinemaId: number, name: string) => `${cinemaId}|${norm(name)}`;

// In HOST của DB đang nối tới, không in user/password.
//
// Đây là chốt chặn quan trọng nhất của script: bẫy đã cắn một lần là chạy nhầm
// vào DB dev mà output vẫn đẹp như thường. Biến môi trường đặt sai chỗ thì
// Prisma âm thầm rơi về `.env`, và không có dòng này thì không cách nào biết.
function dbHost(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "(KHONG CO DATABASE_URL)";
  try {
    return new URL(raw).host;
  } catch {
    return "(DATABASE_URL sai dinh dang)";
  }
}

async function main() {
  console.log(`\nDang noi toi: ${dbHost()}`);
  const [cities, movies, cinemas, users, concessions, rooms] =
    await Promise.all([
      prisma.city.findMany(),
      prisma.movie.findMany(),
      prisma.cinema.findMany(),
      prisma.user.findMany(),
      prisma.concession.findMany(),
      prisma.room.findMany(),
    ]);

  const cityId = new Map(cities.map((c) => [norm(c.name), c.id]));
  const movieId = new Map(movies.map((m) => [norm(m.title), m.id]));
  const cinemaId = new Map(
    cinemas.map((c) => [cinemaKey(c.name, c.address), c.id]),
  );
  const userId = new Map(users.map((u) => [norm(u.email), u.id]));
  const fnbNames = new Set(concessions.map((c) => norm(c.name)));
  const roomId = new Map(rooms.map((r) => [roomKey(r.cinemaId, r.name), r.id]));

  const plan = {
    cities: db.cities.filter((c) => !cityId.has(norm(c.name))),
    movies: db.movies.filter((m) => !movieId.has(norm(m.title))),
    users: db.users.filter((u) => !userId.has(norm(u.email))),
    concessions: db.concessions.filter((c) => !fnbNames.has(norm(c.name))),
    cinemas: db.cinemas.filter(
      (c) => !cinemaId.has(cinemaKey(c.name, c.address)),
    ),
  };

  console.log(
    `\nDB dich dang co: ${movies.length} phim · ${cinemas.length} rap · ${rooms.length} phong · ${users.length} user`,
  );
  console.log("\nDu dinh chen:");
  console.log(`  City       ${plan.cities.length}`);
  console.log(`  Movie      ${plan.movies.length}`);
  console.log(`  User       ${plan.users.length}`);
  console.log(`  Concession ${plan.concessions.length}`);
  console.log(`  Cinema     ${plan.cinemas.length}`);
  console.log("  Room / Showtime: tinh sau khi co id that cua Cinema");

  if (!APPLY) {
    console.log(
      "\n(chua ghi gi — chay lai kem `-- --apply` neu so lieu tren dung)",
    );
    return;
  }

  // --- 1. Bảng không phụ thuộc ai ---
  for (const c of plan.cities) {
    const row = await prisma.city.create({ data: { name: c.name } });
    cityId.set(norm(c.name), row.id);
  }
  for (const m of plan.movies) {
    const row = await prisma.movie.create({
      data: {
        title: m.title,
        poster: m.poster,
        backdrop: (m as { backdrop?: string | null }).backdrop ?? null,
        description: m.description,
        duration: m.duration,
        genre: m.genre,
        rating: m.rating,
      },
    });
    movieId.set(norm(m.title), row.id);
  }
  for (const u of plan.users) {
    const row = await prisma.user.create({
      data: {
        fullName: u.fullName,
        email: u.email,
        password: u.password,
        role: (u as { role?: string }).role ?? "user",
      },
    });
    userId.set(norm(u.email), row.id);
  }
  for (const c of plan.concessions) {
    await prisma.concession.create({
      data: {
        name: c.name,
        category: c.category,
        price: c.price,
        description: c.description,
        image: c.image,
      },
    });
  }

  // --- 2. Cinema (cần id thật của City) ---
  const seedCityName = new Map(db.cities.map((c) => [c.id, c.name]));
  for (const c of plan.cinemas) {
    const realCity = cityId.get(norm(seedCityName.get(c.cityId) ?? ""));
    if (!realCity) {
      console.warn(`  bo qua rap "${c.name}": khong tim thay thanh pho`);
      continue;
    }
    const row = await prisma.cinema.create({
      data: { name: c.name, address: c.address, cityId: realCity },
    });
    cinemaId.set(cinemaKey(c.name, c.address), row.id);
  }

  // --- 3. Room (cần id thật của Cinema) ---
  const seedCinema = new Map(db.cinemas.map((c) => [c.id, c]));
  const seedRoomToReal = new Map<number, number>();
  let roomsAdded = 0;

  for (const r of db.rooms) {
    const sc = seedCinema.get(r.cinemaId);
    if (!sc) continue;
    const realCinema = cinemaId.get(cinemaKey(sc.name, sc.address));
    if (!realCinema) continue;

    const existing = roomId.get(roomKey(realCinema, r.name));
    if (existing) {
      seedRoomToReal.set(r.id, existing);
      continue;
    }
    const row = await prisma.room.create({
      data: {
        name: r.name,
        type: r.type,
        rows: r.rows,
        cols: r.cols,
        vipRows: r.vipRows ?? [],
        coupleRows: (r as { coupleRows?: string[] }).coupleRows ?? [],
        aisleAfterCols:
          (r as { aisleAfterCols?: number[] }).aisleAfterCols ?? [],
        cinemaId: realCinema,
      },
    });
    seedRoomToReal.set(r.id, row.id);
    roomId.set(roomKey(realCinema, r.name), row.id);
    roomsAdded++;
  }

  // --- 4. Showtime: khoá tự nhiên = (roomId thật, time đã dịch) ---
  const seedMovieTitle = new Map(db.movies.map((m) => [m.id, m.title]));
  const existingSt = new Set(
    (
      await prisma.showtime.findMany({ select: { roomId: true, time: true } })
    ).map((s) => `${s.roomId}|${s.time}`),
  );
  const stRows: Prisma.ShowtimeCreateManyInput[] = [];
  for (const s of db.showtimes) {
    const realRoom = seedRoomToReal.get(s.roomId);
    const realMovie = movieId.get(norm(seedMovieTitle.get(s.movieId) ?? ""));
    if (!realRoom || !realMovie) continue;
    const time = shift(s.time);
    const k = `${realRoom}|${time}`;
    if (existingSt.has(k)) continue;
    existingSt.add(k);
    stRows.push({
      movieId: realMovie,
      roomId: realRoom,
      time,
      price: s.price,
      bookedSeats: s.bookedSeats ?? [],
    });
  }
  if (stRows.length) await prisma.showtime.createMany({ data: stRows });

  console.log(
    `\n✅ Da chen: ${plan.cities.length} City · ${plan.movies.length} Movie · ${plan.users.length} User · ${plan.concessions.length} Concession · ${plan.cinemas.length} Cinema · ${roomsAdded} Room · ${stRows.length} Showtime`,
  );
  console.log(
    `   (lich chieu da dich +${OFFSET} ngay de roi vao quanh hom nay ${TODAY})`,
  );
  console.log(
    "   Booking va Review co y KHONG chen: don va danh gia chi co nghia khi la cua nguoi that.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
