import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Smoke e2e chạy trên Chromium. webServer tự bật cả 3 server qua `npm run dev`;
// khi dev đã chạy sẵn (local) thì tái dùng thay vì bật trùng.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
