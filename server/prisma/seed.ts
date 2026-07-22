import { Prisma, PrismaClient } from "@prisma/client";
import db from "../../db.json";

const prisma = new PrismaClient();

// Bảng theo thứ tự FK (cha trước con). Reset sequence sau khi insert id thủ công.
const TABLES = [
  "City",
  "Movie",
  "User",
  "Concession",
  "Cinema",
  "Room",
  "Showtime",
  "Booking",
] as const;

async function clearAll() {
  // Xoá ngược thứ tự FK để không vướng ràng buộc.
  for (const t of [...TABLES].reverse()) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
  }
}

async function resetSequences() {
  // Sau khi insert id thủ công, đẩy sequence tới MAX(id) để insert tự-tăng sau không đụng.
  for (const t of TABLES) {
    await prisma.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), (SELECT COUNT(*) > 0 FROM "${t}"));`,
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

  await prisma.showtime.createMany({ data: db.showtimes });

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
      createdAt: b.createdAt,
    })),
  });

  await resetSequences();
}

// Kỳ vọng khớp db.json — dùng làm "kiểm thử" của lát 3a.
const EXPECTED = {
  City: db.cities.length,
  Movie: db.movies.length,
  User: db.users.length,
  Concession: db.concessions.length,
  Cinema: db.cinemas.length,
  Room: db.rooms.length,
  Showtime: db.showtimes.length,
  Booking: db.bookings.length,
};

async function verify() {
  const counts = {
    City: await prisma.city.count(),
    Movie: await prisma.movie.count(),
    User: await prisma.user.count(),
    Concession: await prisma.concession.count(),
    Cinema: await prisma.cinema.count(),
    Room: await prisma.room.count(),
    Showtime: await prisma.showtime.count(),
    Booking: await prisma.booking.count(),
  };
  console.table(counts);
  const mismatch = Object.entries(EXPECTED).filter(
    ([k, v]) => counts[k as keyof typeof counts] !== v,
  );
  if (mismatch.length) {
    throw new Error(
      `Seed đếm KHÔNG khớp db.json: ${mismatch
        .map(
          ([k, v]) => `${k}: có ${counts[k as keyof typeof counts]}, cần ${v}`,
        )
        .join("; ")}`,
    );
  }
  console.log("✅ Seed khớp db.json (id giữ nguyên, sequence đã reset).");
}

seed()
  .then(verify)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
