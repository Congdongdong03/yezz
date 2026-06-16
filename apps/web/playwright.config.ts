import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Test Configuration for YEZZ
 *
 * Prerequisites for local dev:
 *   pnpm dev:api  (runs on localhost:4000)
 *   pnpm dev:web  (runs on localhost:3000)
 *
 * For CI, the workflow starts services automatically.
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // booking tests share DB state; run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // single worker to avoid DB conflicts between tests
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    // 1. Setup: login as admin and save storage state
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // 2. All other tests reuse the authenticated admin state
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],

  // Optional: auto-start services if not already running (local dev convenience)
  webServer: [
    {
      command: "pnpm --filter @yezz/api build && node apps/api/dist/index.js",
      url: "http://localhost:4000/health",
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: "4000",
        NODE_ENV: "test",
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgres://yezz:yezz@localhost:5432/yezz",
        REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
        JWT_SECRET: process.env.JWT_SECRET ?? "test-secret",
        CORS_ORIGIN: "http://localhost:3000",
      },
    },
    {
      command: "pnpm --filter @yezz/web build && pnpm --filter @yezz/web start",
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
        NEXT_PUBLIC_USE_API: "true",
        PORT: "3000",
      },
    },
  ],
});
