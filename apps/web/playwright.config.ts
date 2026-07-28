import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * E2E Test Configuration for YEZZ
 *
 * Prerequisites for local dev:
 *   pnpm dev:api  (runs on localhost:4000)
 *   pnpm dev:web  (runs on localhost:3000)
 *
 * For CI, the workflow starts services automatically.
 */

const closure = process.env.YEZYY_CLOSURE_E2E === "1";
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const closureSpecs =
  /(?:experience-closure|product-closure|party-closure|rate-limit-identity|email-retry)\.spec\.ts/;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for closure E2E`);
  return value;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // booking tests share DB state; run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // single worker to avoid DB conflicts between tests
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: closure
      ? requiredEnvironment("NEXT_PUBLIC_SITE_URL")
      : "http://localhost:3000",
    ...(closure
      ? {
          extraHTTPHeaders: {
            "x-vercel-forwarded-for": "203.0.113.10",
          },
        }
      : {}),
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
      testMatch: closure ? closureSpecs : undefined,
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
      cwd: repositoryRoot,
      url: "http://localhost:4000/health",
      timeout: 60_000,
      reuseExistingServer: closure ? false : !process.env.CI,
      env: {
        PORT: "4000",
        NODE_ENV: "test",
        DATABASE_URL:
          closure
            ? requiredEnvironment("DATABASE_URL")
            : process.env.DATABASE_URL ??
              "postgres://yezz:yezz@localhost:5432/yezz",
        REDIS_URL: closure
          ? ""
          : process.env.REDIS_URL ?? "redis://localhost:6379",
        JWT_SECRET: process.env.JWT_SECRET ?? "test-secret",
        CORS_ORIGIN: "http://localhost:3000",
        ...(closure
          ? {
              EMAIL_FROM: requiredEnvironment("EMAIL_FROM"),
              EMAIL_OUTBOX_POLL_MILLISECONDS: requiredEnvironment(
                "EMAIL_OUTBOX_POLL_MILLISECONDS",
              ),
              EMAIL_OUTBOX_WORKER_ENABLED: "true",
              EMAIL_PROVIDER: "smtp",
              EMAIL_REPLY_TO: requiredEnvironment("EMAIL_REPLY_TO"),
              INTERNAL_REQUEST_ENFORCEMENT: "require",
              OWNER_EMAIL: requiredEnvironment("OWNER_EMAIL"),
              RATE_LIMIT_HASH_SECRET: requiredEnvironment(
                "RATE_LIMIT_HASH_SECRET",
              ),
              REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
              REQUEST_FLOW_PARTY_ENABLED: "true",
              REQUEST_FLOW_PRODUCT_ENABLED: "true",
              SMTP_HOST: "127.0.0.1",
              SMTP_PORT: requiredEnvironment("SMTP_PORT"),
              WEB_API_SHARED_SECRET: requiredEnvironment(
                "WEB_API_SHARED_SECRET",
              ),
              YEZYY_CLOSURE_E2E: "1",
            }
          : {}),
      },
    },
    {
      command: "pnpm --filter @yezz/web build && pnpm --filter @yezz/web start",
      cwd: repositoryRoot,
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: closure ? false : !process.env.CI,
      env: {
        API_URL: closure
          ? requiredEnvironment("API_URL")
          : "http://localhost:4000",
        NEXT_PUBLIC_API_URL: closure
          ? requiredEnvironment("NEXT_PUBLIC_API_URL")
          : "http://localhost:4000",
        NEXT_PUBLIC_SITE_URL: closure
          ? requiredEnvironment("NEXT_PUBLIC_SITE_URL")
          : "http://localhost:3000",
        NEXT_PUBLIC_USE_API: "true",
        PORT: "3000",
        ...(closure
          ? {
              VERCEL: "1",
              WEB_API_SHARED_SECRET: requiredEnvironment(
                "WEB_API_SHARED_SECRET",
              ),
              YEZYY_CLOSURE_E2E: "1",
            }
          : {}),
      },
    },
  ],
});
