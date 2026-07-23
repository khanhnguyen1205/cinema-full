// Metadata mô tả từng collection REST — THUẦN (không import Prisma) để test không cần DB.
// Danh sách trường bám đúng server/prisma/schema.prisma.
export type CollectionName =
  | "movies"
  | "showtimes"
  | "cinemas"
  | "cities"
  | "rooms"
  | "concessions"
  | "bookings"
  | "users";

type FilterType = "int" | "string";

type CollectionSpec = {
  filterable: Record<string, FilterType>; // query ?field= được phép lọc
  writable: string[]; // trường được nhận từ body (chặn ghi id / rác)
  json: string[]; // trường Json (null cần Prisma.DbNull)
};

export const COLLECTIONS: Record<CollectionName, CollectionSpec> = {
  movies: {
    filterable: { id: "int" },
    writable: ["title", "poster", "description", "duration", "genre", "rating"],
    json: [],
  },
  showtimes: {
    filterable: { id: "int", movieId: "int", roomId: "int" },
    writable: ["time", "price", "bookedSeats", "movieId", "roomId"],
    json: [],
  },
  cinemas: {
    filterable: { id: "int", cityId: "int" },
    writable: ["name", "address", "cityId"],
    json: [],
  },
  cities: {
    filterable: { id: "int" },
    writable: ["name"],
    json: [],
  },
  rooms: {
    filterable: { id: "int", cinemaId: "int" },
    writable: [
      "name",
      "type",
      "rows",
      "cols",
      "vipRows",
      "coupleRows",
      "aisleAfterCols",
      "cinemaId",
    ],
    json: [],
  },
  concessions: {
    filterable: { id: "int" },
    writable: ["name", "category", "price", "description", "image"],
    json: [],
  },
  bookings: {
    filterable: { id: "int", userId: "int", showtimeId: "int" },
    writable: [
      "movieId",
      "showtimeId",
      "cinemaId",
      "roomId",
      "seats",
      "seatTypes",
      "concessions",
      "paymentMethod",
      "userId",
      "userName",
      "seatTotal",
      "fnbTotal",
      "serviceFee",
      "totalPrice",
      "createdAt",
    ],
    json: ["seatTypes", "concessions"],
  },
  users: {
    filterable: { id: "int", email: "string", role: "string" },
    writable: ["fullName", "email", "password", "role"],
    json: [],
  },
};

export function isCollection(name: string): name is CollectionName {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, name);
}

// ?movieId=5 (chuỗi) -> { movieId: 5 }. Bỏ qua tham số lạ hoặc số không hợp lệ.
export function parseFilters(
  c: CollectionName,
  query: Record<string, unknown>,
): Record<string, string | number> {
  const spec = COLLECTIONS[c];
  const where: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(query)) {
    const type = spec.filterable[key];
    if (!type || raw == null) continue;
    if (type === "int") {
      const n = Number(raw);
      if (Number.isFinite(n)) where[key] = n;
    } else {
      where[key] = String(raw);
    }
  }
  return where;
}

// Chỉ nhận trường có trong schema (chặn ghi đè id và field rác json-server từng nuốt).
export function pickWritable(
  c: CollectionName,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const spec = COLLECTIONS[c];
  const data: Record<string, unknown> = {};
  for (const key of spec.writable) {
    if (key in body && body[key] !== undefined) data[key] = body[key];
  }
  return data;
}
