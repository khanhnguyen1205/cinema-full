/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// Giữ absolute imports kiểu baseUrl:"src" (components/…, services/…) qua alias.
const srcDir = (p) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Cinema — The Cinematic Editorial",
        short_name: "Cinema",
        description:
          "Đặt vé xem phim: chọn suất, chọn ghế, bắp nước và nhận vé điện tử QR.",
        lang: "vi",
        dir: "ltr",
        display: "standalone",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        start_url: "/",
        scope: "/",
        categories: ["entertainment"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico,webmanifest}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        runtimeCaching: [
          {
            urlPattern:
              /\/api\/(movies|showtimes|cinemas|cities|rooms|concessions|reviews)(\/|\?|$)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "catalog-api",
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      components: srcDir("components"),
      context: srcDir("context"),
      hooks: srcDir("hooks"),
      i18n: srcDir("i18n"),
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
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}", "server/src/**/*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "src/test/**",
        "server/src/test/**",
        "src/pages/dev/**",
        "src/types/**",
        "src/vite-env.d.ts",
        "server/src/index.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "happy-dom", // cần DOM cho test component (Testing Library)
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          // Ghim URL để handler MSW cố định — CI không có .env, máy dev thì có.
          env: {
            VITE_API_URL: "http://localhost:4000/api",
            VITE_AUTH_URL: "http://localhost:4000",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          // Test server bắn request vào app Express thật (supertest), không cần DOM.
          environment: "node",
          setupFiles: ["./server/src/test/setup.ts"],
          include: ["server/**/*.{test,spec}.ts"],
        },
      },
    ],
  },
});
