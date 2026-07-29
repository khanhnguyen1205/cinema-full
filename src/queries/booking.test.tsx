import { describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { renderQueryHook } from "test/queryWrapper";
import { qk } from "./keys";
import { useConcessions, useCreateBooking, useOccupiedSeats } from "./booking";

const API = "http://localhost:4000/api";

describe("queries/booking", () => {
  it("useOccupiedSeats trả danh sách ghế đã chiếm", async () => {
    const { result } = renderQueryHook(() => useOccupiedSeats(1));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(["A1", "A2"]);
  });

  it("useOccupiedSeats KHÔNG gọi mạng khi enabled=false", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/occupied-seats`, () => {
        calls++;
        return HttpResponse.json({ seats: [] });
      }),
    );

    const { result } = renderQueryHook(() =>
      useOccupiedSeats(1, { enabled: false }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(0);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useConcessions trả danh mục bắp nước", async () => {
    const { result } = renderQueryHook(() => useConcessions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("useCreateBooking đặt xong thì LÀM MỚI vé của tôi + ghế của suất đó", async () => {
    server.use(
      http.post(`${API}/bookings`, () =>
        HttpResponse.json({ id: 99 }, { status: 201 }),
      ),
    );

    const { result, queryClient } = renderQueryHook(() => useCreateBooking());
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.mutateAsync({ showtimeId: 1, seats: ["B3"] });

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.myBookings });
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.occupiedSeats(1) });
  });
});
