import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import usePagination from "./usePagination";

const items = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => i + 1);

describe("usePagination", () => {
  it("cắt đúng trang đầu và đếm đúng tổng số trang", () => {
    const { result } = renderHook(() => usePagination(items(25), 10));
    expect(result.current.pageItems).toHaveLength(10);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.from).toBe(1);
    expect(result.current.to).toBe(10);
    expect(result.current.total).toBe(25);
  });

  it("trang cuối chỉ lấy phần còn lại", () => {
    const { result } = renderHook(() => usePagination(items(25), 10));
    act(() => result.current.setPage(3));
    expect(result.current.pageItems).toEqual([21, 22, 23, 24, 25]);
    expect(result.current.from).toBe(21);
    expect(result.current.to).toBe(25);
  });

  it("danh sách rỗng: 1 trang, from = 0", () => {
    const { result } = renderHook(() => usePagination<number>([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(0);
  });

  it("danh sách co lại (sau khi tìm kiếm/xoá) thì nhảy về trang 1", () => {
    const { result, rerender } = renderHook(
      ({ list }) => usePagination(list, 10),
      { initialProps: { list: items(25) } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ list: items(5) }); // còn 1 trang
    expect(result.current.page).toBe(1);
  });
});
