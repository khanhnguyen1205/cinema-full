import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import Movies from "./Movies";

// Bộ lọc của trang này lấy URL làm nguồn sự thật -> phải soi được query string.
function Probe() {
  const loc = useLocation();
  return <span data-testid="qs">{loc.search}</span>;
}

const setup = async (route = "/movies", awaitText = "Điện Biên Phủ") => {
  const r = renderWithProviders(
    <>
      <Movies />
      <Probe />
    </>,
    { route },
  );
  await screen.findByText("Danh mục phim");
  // Chờ hết skeleton: hoặc thấy thẻ phim, hoặc thấy trạng thái rỗng.
  await screen.findByText(awaitText);
  return r;
};

const titles = () =>
  Array.from(
    document.querySelectorAll(".movie-k__title"),
    (n) => n.textContent,
  );
const qs = () => screen.getByTestId("qs").textContent ?? "";

const chip = (group: string, name: string | RegExp) =>
  within(screen.getByRole("group", { name: group })).getByRole("button", {
    name,
  });

describe("Movies", () => {
  it("mặc định liệt kê mọi phim, xếp theo tên A→Z", async () => {
    await setup();
    expect(titles()).toEqual([
      "Điện Biên Phủ",
      "Endgame",
      "Phim Chưa Xếp Lịch",
    ]);
    expect(qs()).toBe("");
  });

  it("chip thể loại ghi vào URL và lọc danh sách", async () => {
    await setup();
    await userEvent.click(chip("Thể loại", "Hành động"));

    await waitFor(() => expect(qs()).toContain("genres=Action"));
    expect(titles()).toEqual(["Điện Biên Phủ"]);
    expect(chip("Thể loại", "Hành động")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("chip điểm ≥ 8 chỉ giữ phim đủ điểm", async () => {
    await setup();
    await userEvent.click(chip("Điểm", "≥ 8"));

    await waitFor(() => expect(qs()).toContain("rating=8"));
    expect(titles()).toEqual(["Điện Biên Phủ"]);
  });

  it("chip định dạng lọc theo loại phòng của suất chiếu", async () => {
    await setup();
    await userEvent.click(chip("Định dạng", "IMAX"));

    await waitFor(() => expect(qs()).toContain("fmt=IMAX"));
    // Chỉ Endgame có suất ở phòng IMAX; phim chưa xếp lịch không có suất nào.
    expect(titles()).toEqual(["Endgame"]);
  });

  it("tìm theo tên KHÔNG DẤU vẫn khớp phim có dấu", async () => {
    await setup();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Tìm phim theo tên..." }),
      "dien bien",
    );
    await waitFor(() => expect(titles()).toEqual(["Điện Biên Phủ"]));
    expect(qs()).toContain("q=dien+bien");
  });

  it("đổi sắp xếp sang Z→A đảo thứ tự thẻ phim", async () => {
    await setup();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sắp xếp" }),
      "name-desc",
    );
    await waitFor(() =>
      expect(titles()).toEqual([
        "Phim Chưa Xếp Lịch",
        "Endgame",
        "Điện Biên Phủ",
      ]),
    );
  });

  it("lọc không ra gì thì báo rỗng chứ không phải lưới trống", async () => {
    await setup("/movies?q=khongcophimnao", "Không tìm thấy phim nào");
    expect(
      screen.getByText("Thử đổi từ khóa hoặc bộ lọc khác."),
    ).toBeInTheDocument();
    expect(titles()).toEqual([]);
  });

  it("Xóa lọc dọn sạch URL và trả lại đủ phim", async () => {
    await setup("/movies?genres=Action&rating=8&fmt=2D");
    expect(titles()).toEqual(["Điện Biên Phủ"]);

    await userEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    await waitFor(() => expect(qs()).toBe(""));
    expect(titles()).toHaveLength(3);
  });

  it("genre mang từ Home vào URL đúng MỘT lần — Xóa lọc vẫn xoá được", async () => {
    // Home điều hướng bằng navigate("/movies", { state: { genre } }).
    renderWithProviders(
      <>
        <Movies />
        <Probe />
      </>,
      { route: "/movies", state: { genre: "Sci-Fi" } },
    );
    await screen.findByText("Endgame");
    await waitFor(() => expect(qs()).toContain("genres=Sci-Fi"));
    expect(titles()).toEqual(["Endgame"]);

    // Nếu state được nạp lại mỗi lần URL trống thì nút này sẽ vô dụng.
    await userEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    await waitFor(() => expect(qs()).toBe(""));
    expect(titles()).toHaveLength(3);
  });
});
