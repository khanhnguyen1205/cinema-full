import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "i18n"; // khởi tạo i18next (mặc định vi) để useTranslation trả chuỗi trong test

// Dọn DOM sau mỗi test (do dùng globals: false).
afterEach(() => cleanup());
