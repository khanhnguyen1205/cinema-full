/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Giữ absolute imports kiểu baseUrl:"src" (components/…, services/…) qua alias.
const srcDir = (p) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      components: srcDir("components"),
      context: srcDir("context"),
      hooks: srcDir("hooks"),
      lib: srcDir("lib"),
      pages: srcDir("pages"),
      queries: srcDir("queries"),
      routes: srcDir("routes"),
      services: srcDir("services"),
      styles: srcDir("styles"),
      types: srcDir("types"),
    },
  },
  server: {
    port: 3000, // giữ :3000 (start-dev.ps1, CORS auth WEB_ORIGIN, hook đều giả định)
    strictPort: true,
  },
  build: {
    outDir: "build", // giữ thư mục output như CRA (đã có trong .gitignore)
  },
  test: {
    environment: "happy-dom", // cần DOM cho test component (Testing Library)
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.ts"],
  },
});
