// Bản giả của prisma singleton: app Express vẫn là app THẬT (đúng mount order,
// đúng middleware, đúng luật gateway), chỉ tầng chạm DB được thay.
import { vi } from "vitest";

const delegate = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
});

export const prismaMock = {
  movie: delegate(),
  showtime: delegate(),
  cinema: delegate(),
  city: delegate(),
  room: delegate(),
  concession: delegate(),
  booking: delegate(),
  review: delegate(),
  user: delegate(),
  // schedule/refresh.ts gói các update vào một transaction. Bản giả chỉ cần chạy hết
  // mảng lời gọi — đủ để khẳng định "một transaction, không phải N lần ghi rời".
  $transaction: vi.fn((ops: unknown[]) =>
    Promise.all(ops as Promise<unknown>[]),
  ),
};

export function resetPrismaMock(): void {
  for (const [name, d] of Object.entries(prismaMock)) {
    // `$transaction` là một fn phẳng chứ không phải delegate; mockClear để giữ lại
    // cài đặt mặc định (mockReset sẽ vứt nó đi).
    if (name.startsWith("$")) {
      (d as ReturnType<typeof vi.fn>).mockClear();
      continue;
    }
    for (const fn of Object.values(d)) fn.mockReset();
  }
}
