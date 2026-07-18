import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Dọn DOM sau mỗi test (do dùng globals: false).
afterEach(() => cleanup());
