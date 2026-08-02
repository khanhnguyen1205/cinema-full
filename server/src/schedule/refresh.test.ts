import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { addDays } from "./date-shift";
import { refreshShowtimes, startShowtimeRefresh } from "./refresh";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

// Mốc thời gian dựng theo NGÀY HÔM NAY THẬT (giờ địa phương, y như refresh.ts đọc),
// nên bộ test đúng bất kể chạy ngày nào — không phải đóng băng đồng hồ.
const p2 = (n: number): string => String(n).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
const at = (offsetDays: number, clock = "18:00:00"): string =>
  addDays(`${TODAY}T${clock}`, offsetDays);

const rowsOf = (times: string[]): { id: number; time: string }[] =>
  times.map((time, i) => ({ id: i + 1, time }));

beforeEach(() => {
  resetPrismaMock();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("refreshShowtimes", () => {
  it("cửa sổ vừa seed xong thì không ghi gì cả", async () => {
    prismaMock.showtime.findMany.mockResolvedValue(
      rowsOf([-2, -1, 0, 1, 2, 3, 4].map((d) => at(d))),
    );

    expect(await refreshShowtimes()).toBeNull();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.showtime.update).not.toHaveBeenCalled();
  });

  it("cửa sổ đã trôi vào quá khứ thì dịch, ghi trong MỘT transaction", async () => {
    prismaMock.showtime.findMany.mockResolvedValue(
      rowsOf([at(-12, "10:00:00"), at(-6, "21:00:00")]),
    );

    // Sớm nhất đang ở hôm nay-12, phải kéo về hôm nay-2 ⇒ +10 ngày.
    expect(await refreshShowtimes()).toBe(10);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.showtime.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { time: at(-2, "10:00:00") },
    });
    expect(prismaMock.showtime.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: { time: at(4, "21:00:00") },
    });
  });

  it("giữ nguyên giờ chiếu trong ngày khi dịch", async () => {
    prismaMock.showtime.findMany.mockResolvedValue(
      rowsOf([at(-9, "08:15:00")]),
    );

    await refreshShowtimes();
    const arg = prismaMock.showtime.update.mock.calls[0][0] as {
      data: { time: string };
    };
    expect(arg.data.time.endsWith("T08:15:00")).toBe(true);
  });

  it("DB rỗng thì đứng im (chưa seed lần nào, không phải việc của nó)", async () => {
    prismaMock.showtime.findMany.mockResolvedValue([]);

    expect(await refreshShowtimes()).toBeNull();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("đọc lỗi thì KHÔNG ném — server không được sập vì việc này", async () => {
    prismaMock.showtime.findMany.mockRejectedValue(new Error("mất kết nối"));

    await expect(refreshShowtimes()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("ghi lỗi thì cũng KHÔNG ném", async () => {
    prismaMock.showtime.findMany.mockResolvedValue(rowsOf([at(-12)]));
    prismaMock.$transaction.mockRejectedValueOnce(new Error("hết phiên"));

    await expect(refreshShowtimes()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("hai lượt chồng nhau: lượt thứ hai đứng im ngay", async () => {
    let release: (rows: unknown[]) => void = () => {};
    prismaMock.showtime.findMany.mockReturnValue(
      new Promise((r) => {
        release = r as (rows: unknown[]) => void;
      }),
    );

    const first = refreshShowtimes();
    // Lượt đầu còn đang chờ DB ⇒ cờ `running` phải chặn lượt này.
    expect(await refreshShowtimes()).toBeNull();
    expect(prismaMock.showtime.findMany).toHaveBeenCalledTimes(1);

    release([]);
    await first;
  });
});

describe("startShowtimeRefresh", () => {
  it("chạy một lượt ngay khi server khởi động", async () => {
    prismaMock.showtime.findMany.mockResolvedValue([]);

    startShowtimeRefresh();

    await vi.waitFor(() =>
      expect(prismaMock.showtime.findMany).toHaveBeenCalledTimes(1),
    );
  });
});
