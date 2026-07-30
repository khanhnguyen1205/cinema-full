import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import GlobalSearch from "./GlobalSearch";

function Probe() {
  const loc = useLocation();
  return (
    <span data-testid="path">
      {loc.pathname}
      {loc.search}
    </span>
  );
}

const setup = async () => {
  renderWithProviders(
    <>
      <GlobalSearch />
      <Probe />
    </>,
  );
  // renderWithProviders giữ children tới khi kiểm tra phiên xong -> phải chờ.
  return await screen.findByRole("combobox", { name: "Tìm phim, rạp..." });
};

const type = async (input: HTMLElement, text: string) => {
  await userEvent.clear(input);
  await userEvent.type(input, text);
};

const dropdown = async () => await screen.findByRole("listbox");

describe("GlobalSearch", () => {
  it("chưa gõ gì thì không có dropdown", async () => {
    const input = await setup();
    await userEvent.click(input);
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("gõ xong thì mở dropdown và khai báo aria-expanded/aria-controls", async () => {
    const input = await setup();
    await type(input, "endgame");
    const list = await dropdown();
    expect(list).toHaveAttribute("id", "gsearch-list");
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    expect(input).toHaveAttribute("aria-controls", "gsearch-list");
  });

  // Ghi chú: KHÔNG khẳng định con số 150ms của debounce ở đây. Đã thử timer giả
  // (`vi.useFakeTimers` + `advanceTimers` của userEvent) và nó treo cả file —
  // đúng bài học T4: timer giả và I/O của MSW không sống chung được. Điều thực
  // sự quan trọng — dropdown cuối cùng phản ánh ĐỦ chuỗi đã gõ, không phải một
  // phím lẻ — được khoá bởi các test bên dưới (q trong `/search?q=endgame`).

  it("tìm không dấu vẫn ra phim có dấu", async () => {
    const input = await setup();
    await type(input, "dien bien");
    const list = await dropdown();
    // Tên phim còn xuất hiện ở nhóm SUẤT CHIẾU -> soi riêng nhóm PHIM.
    const group = within(list).getByText("PHIM").closest(".gsearch__group");
    expect(group).not.toBeNull();
    expect(
      within(group as HTMLElement).getByText("Điện Biên Phủ"),
    ).toBeInTheDocument();
    expect(within(list).queryByText("Endgame")).not.toBeInTheDocument();
  });

  it("gợi ý suất chiếu BỎ QUA suất đã chiếu", async () => {
    const input = await setup();
    await type(input, "dien bien");
    const list = await dropdown();
    // Fixture có 2 suất của phim này: một tương lai (id 1), một quá khứ (id 2).
    const shows = within(list)
      .getAllByRole("option")
      .filter((o) => o.className.includes("gsearch__item"))
      .filter((o) => o.textContent?.includes("Cinema Hoàn Kiếm"));
    expect(shows).toHaveLength(1);
  });

  it("tìm theo tên rạp ra nhóm RẠP kèm địa chỉ", async () => {
    const input = await setup();
    await type(input, "hoan kiem");
    const list = await dropdown();
    expect(within(list).getByText("RẠP")).toBeInTheDocument();
    expect(within(list).getByText("Cinema Hoàn Kiếm")).toBeInTheDocument();
    expect(within(list).getByText("1 Tràng Tiền")).toBeInTheDocument();
  });

  it("không có kết quả thì báo và vẫn mời tìm nâng cao", async () => {
    const input = await setup();
    await type(input, "zzzz");
    const list = await dropdown();
    expect(
      within(list).getByText("Không tìm thấy. Nhấn Enter để tìm nâng cao."),
    ).toBeInTheDocument();
  });

  it("mũi tên xuống/lên di chuyển con trỏ trong danh sách phẳng", async () => {
    const input = await setup();
    await type(input, "endgame");
    await dropdown();

    await userEvent.keyboard("{ArrowDown}");
    const options = screen.getAllByRole("option");
    await waitFor(() =>
      expect(options[0]).toHaveAttribute("aria-selected", "true"),
    );

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(options[1]).toHaveAttribute("aria-selected", "true"),
    );
    expect(options[0]).toHaveAttribute("aria-selected", "false");

    await userEvent.keyboard("{ArrowUp}");
    await waitFor(() =>
      expect(options[0]).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("Enter khi đang chọn mục đầu thì mở đúng phim", async () => {
    const input = await setup();
    await type(input, "endgame");
    await dropdown();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("path")).toHaveTextContent("/movie/2");
  });

  it("Enter khi chưa chọn mục nào thì sang trang tìm nâng cao", async () => {
    const input = await setup();
    await type(input, "endgame");
    await dropdown();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("path")).toHaveTextContent("/search?q=endgame");
  });

  it("bấm một gợi ý thì điều hướng, đóng dropdown và xoá ô nhập", async () => {
    const input = await setup();
    await type(input, "hoan kiem");
    const list = await dropdown();
    await userEvent.click(within(list).getByText("Cinema Hoàn Kiếm"));

    expect(screen.getByTestId("path")).toHaveTextContent("/cinema/1");
    expect(input).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Escape đóng dropdown, giữ nguyên chữ đã gõ", async () => {
    const input = await setup();
    await type(input, "endgame");
    await dropdown();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue("endgame");
  });
});
