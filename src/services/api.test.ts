import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import {
  createBooking,
  getMovies,
  getOccupiedSeats,
  getShowtimesByCinema,
  holdSeats,
  releaseSeats,
} from "./api";

const API = "http://localhost:4000/api";

describe("services/api — đọc catalog", () => {
  it("getMovies gọi đúng đường dẫn và kèm cookie", async () => {
    let credentials = "";
    server.use(
      http.get(`${API}/movies`, ({ request }) => {
        credentials = request.credentials;
        return HttpResponse.json(fx.movies);
      }),
    );

    const movies = await getMovies();
    expect(movies).toHaveLength(2);
    expect(credentials).toBe("include");
  });

  it("getShowtimesByCinema: lấy phòng của rạp rồi gom suất theo từng phòng", async () => {
    const roomIds: string[] = [];
    let cinemaFilter: string | null = null;
    server.use(
      http.get(`${API}/rooms`, ({ request }) => {
        cinemaFilter = new URL(request.url).searchParams.get("cinemaId");
        return HttpResponse.json([{ id: 1 }, { id: 2 }]);
      }),
      http.get(`${API}/showtimes`, ({ request }) => {
        const roomId = new URL(request.url).searchParams.get("roomId");
        if (roomId) roomIds.push(roomId);
        return HttpResponse.json([{ id: Number(roomId) * 10 }]);
      }),
    );

    const list = await getShowtimesByCinema(1);

    expect(cinemaFilter).toBe("1");
    expect(roomIds.sort()).toEqual(["1", "2"]);
    expect(list.map((s) => s.id).sort()).toEqual([10, 20]);
  });
});

describe("services/api — ghế", () => {
  it("getOccupiedSeats bóc mảng seats ra khỏi phong bì {showtimeId, seats}", async () => {
    await expect(getOccupiedSeats(1)).resolves.toEqual(["A1", "A2"]);
  });

  it("server không trả seats thì ra mảng rỗng, không nổ", async () => {
    server.use(http.get(`${API}/occupied-seats`, () => HttpResponse.json({})));
    await expect(getOccupiedSeats(1)).resolves.toEqual([]);
  });

  it("holdSeats POST kèm showtimeId + seats, TRẢ NGUYÊN Response để đọc 409", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/holds`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { error: "Ghế vừa bị người khác giữ.", conflicts: ["B3"] },
          { status: 409 },
        );
      }),
    );

    const res = await holdSeats(1, ["B3"]);

    expect(body).toEqual({ showtimeId: 1, seats: ["B3"] });
    expect(res.status).toBe(409);
    const parsed = (await res.json()) as { conflicts: string[] };
    expect(parsed.conflicts).toEqual(["B3"]);
  });

  it("releaseSeats gọi DELETE kèm showtimeId", async () => {
    let method = "";
    let showtimeId: string | null = null;
    server.use(
      http.delete(`${API}/holds`, ({ request }) => {
        method = request.method;
        showtimeId = new URL(request.url).searchParams.get("showtimeId");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await releaseSeats(7);
    expect(method).toBe("DELETE");
    expect(showtimeId).toBe("7");
  });
});

describe("services/api — đặt vé", () => {
  it("gửi header x-lang để server chọn ngôn ngữ email vé", async () => {
    let lang: string | null = null;
    server.use(
      http.post(`${API}/bookings`, ({ request }) => {
        lang = request.headers.get("x-lang");
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
    );

    await createBooking({ showtimeId: 1, seats: ["B3"] });
    expect(lang).toBe("vi"); // i18n mặc định trong test
  });

  it("gateway từ chối (409) thì NÉM LỖI, không trả thân lỗi như thể là Booking", async () => {
    server.use(
      http.post(`${API}/bookings`, () =>
        HttpResponse.json(
          { error: "Ghế vừa bị người khác giữ." },
          { status: 409 },
        ),
      ),
    );

    await expect(createBooking({ showtimeId: 1 })).rejects.toThrow();
  });
});
