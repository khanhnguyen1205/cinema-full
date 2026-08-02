import { Prisma, PrismaClient } from "@prisma/client";
import db from "../../db.json";
import { addDays, dayOf, offsetDaysFor } from "../src/schedule/date-shift";

const prisma = new PrismaClient();

// db.json giữ ngày cứng; seed dịch cả bộ về quanh HÔM NAY để suất chiếu không bao giờ
// cũ (xem date-shift.ts). Một offset duy nhất cho mọi bảng nên quan hệ thời gian giữa
// đơn đặt, suất chiếu và đánh giá vẫn y như trong fixture.
const TODAY = new Date().toISOString().slice(0, 10);
const EARLIEST = db.showtimes.map((s) => dayOf(s.time)).sort()[0] ?? TODAY;
const OFFSET = offsetDaysFor(EARLIEST, TODAY);
const shift = (iso: string): string => addDays(iso, OFFSET);

// Mỗi bảng khai báo ĐÚNG MỘT LẦN: thứ tự FK (cha trước con), nguồn fixture để đối
// chiếu số dòng, và cách đếm sau khi nạp. Thêm bảng mới chỉ phải sửa danh sách này.
const TABLES = [
  { name: "City", fixture: db.cities, count: () => prisma.city.count() },
  { name: "Movie", fixture: db.movies, count: () => prisma.movie.count() },
  { name: "User", fixture: db.users, count: () => prisma.user.count() },
  {
    name: "Concession",
    fixture: db.concessions,
    count: () => prisma.concession.count(),
  },
  { name: "Cinema", fixture: db.cinemas, count: () => prisma.cinema.count() },
  { name: "Room", fixture: db.rooms, count: () => prisma.room.count() },
  {
    name: "Showtime",
    fixture: db.showtimes,
    count: () => prisma.showtime.count(),
  },
  {
    name: "Booking",
    fixture: db.bookings,
    count: () => prisma.booking.count(),
  },
  { name: "Review", fixture: db.reviews, count: () => prisma.review.count() },
] as const;

async function clearAll() {
  // Xoá ngược thứ tự FK để không vướng ràng buộc.
  for (const t of [...TABLES].reverse()) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t.name}";`);
  }
}

async function resetSequences() {
  // Sau khi insert id thủ công, đẩy sequence tới MAX(id) để insert tự-tăng sau không đụng.
  for (const t of TABLES) {
    await prisma.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t.name}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t.name}"), 1), (SELECT COUNT(*) > 0 FROM "${t.name}"));`,
    );
  }
}

async function seed() {
  await clearAll();

  await prisma.city.createMany({ data: db.cities });

  await prisma.movie.createMany({ data: db.movies });

  await prisma.user.createMany({
    data: db.users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      password: u.password,
      role: (u as { role?: string }).role ?? "user",
    })),
  });

  await prisma.concession.createMany({ data: db.concessions });

  await prisma.cinema.createMany({ data: db.cinemas });

  await prisma.room.createMany({
    data: db.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      rows: r.rows,
      cols: r.cols,
      vipRows: r.vipRows ?? [],
      coupleRows: (r as { coupleRows?: string[] }).coupleRows ?? [],
      aisleAfterCols: (r as { aisleAfterCols?: number[] }).aisleAfterCols ?? [],
      cinemaId: r.cinemaId,
    })),
  });

  await prisma.showtime.createMany({
    data: db.showtimes.map((s) => ({ ...s, time: shift(s.time) })),
  });

  await prisma.booking.createMany({
    data: db.bookings.map((b) => ({
      id: b.id,
      movieId: b.movieId,
      showtimeId: b.showtimeId,
      cinemaId: b.cinemaId,
      roomId: b.roomId,
      seats: b.seats,
      seatTypes: b.seatTypes as Prisma.InputJsonValue,
      concessions:
        (b as { concessions?: Prisma.InputJsonValue }).concessions ?? undefined,
      userId: b.userId,
      userName: b.userName,
      totalPrice: b.totalPrice,
      createdAt: shift(b.createdAt),
    })),
  });

  await prisma.review.createMany({
    data: db.reviews.map((r) => ({ ...r, createdAt: shift(r.createdAt) })),
  });

  await resetSequences();
}

// Số dòng phải khớp db.json — dùng làm "kiểm thử" của lát 3a.
async function verify() {
  const counts: Record<string, number> = {};
  for (const t of TABLES) counts[t.name] = await t.count();
  console.table(counts);

  const mismatch = TABLES.filter((t) => counts[t.name] !== t.fixture.length);
  if (mismatch.length) {
    throw new Error(
      `Seed đếm KHÔNG khớp db.json: ${mismatch
        .map((t) => `${t.name}: có ${counts[t.name]}, cần ${t.fixture.length}`)
        .join("; ")}`,
    );
  }
  const days = [
    ...new Set(
      (await prisma.showtime.findMany({ select: { time: true } })).map((s) =>
        dayOf(s.time),
      ),
    ),
  ].sort();
  console.log(
    `📅 Đã dịch mốc thời gian ${OFFSET >= 0 ? "+" : ""}${OFFSET} ngày: suất chiếu trải từ ${days[0]} đến ${days[days.length - 1]} (hôm nay ${TODAY}).`,
  );
  console.log("✅ Seed khớp db.json (id giữ nguyên, sequence đã reset).");
}

seed()
  .then(verify)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
