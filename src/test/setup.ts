import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "i18n"; // khởi tạo i18next (mặc định vi) để useTranslation trả chuỗi trong test
import { server } from "./msw/server";
import { resetFixtureDb } from "./msw/handlers";

// onUnhandledRequest:"error" — request nào chưa khai báo handler thì test ĐỎ.
// Không có nó, một lời gọi mạng bị bỏ quên sẽ lặng lẽ treo rồi test vẫn xanh.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetFixtureDb(); // bảng reviews có ghi -> trả về nguyên trạng fixture
  cleanup(); // dọn DOM sau mỗi test (do dùng globals: false)
});
afterAll(() => server.close());
