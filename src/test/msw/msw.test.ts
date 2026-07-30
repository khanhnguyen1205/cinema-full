import { describe, expect, it } from "vitest";
import { getMovies } from "services/api";
import { fx } from "../fixtures";

// Canary hạ tầng: gọi service THẬT để chứng minh MSW chặn được fetch mà
// services/api.ts dùng. Hỏng bài này thì mọi test trang phía sau đều vô nghĩa.
describe("hạ tầng MSW", () => {
  it("chặn được fetch của services/api.ts và trả fixtures", async () => {
    const movies = await getMovies();
    expect(movies).toHaveLength(fx.movies.length);
    expect(movies[0].title).toBe("Điện Biên Phủ");
  });
});
