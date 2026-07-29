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
};

export function resetPrismaMock(): void {
  for (const d of Object.values(prismaMock)) {
    for (const fn of Object.values(d)) fn.mockReset();
  }
}
