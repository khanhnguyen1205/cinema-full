import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // Không lint các thư mục sinh ra / phụ thuộc
  {
    ignores: ["build", "dist", "coverage", "node_modules"],
  },

  // Nền tảng: JS + TS recommended cho toàn bộ mã nguồn client (src)
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Cho phép prefix _ để chủ ý bỏ biến/tham số không dùng
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Server Node (CommonJS) — không dùng luật type-aware của TS
  {
    files: ["server/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },

  // Server TypeScript (Prisma seed + code server ở lát sau) — non-type-aware
  {
    files: ["server/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Các file cấu hình ở gốc chạy trong môi trường Node
  {
    files: ["*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // E2E Playwright (ngoài src, không nằm trong tsconfig của app)
  {
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Tắt các luật xung đột với Prettier (đặt cuối để thắng)
  prettier,
);
