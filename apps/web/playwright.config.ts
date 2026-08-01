import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertClosureSafety } from "./e2e/closure-safety";

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
  /(?:experience-closure|rate-limit-identity|email-retry|live-ordinary-booking|live-waitlist|live-party-booking|live-customer-actions)\.spec\.ts/;
const liveClosureSpecs =
  /(?:live-ordinary-booking|live-waitlist|live-party-booking|live-customer-actions)\.spec\.ts/;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for closure E2E`);
  return value;
}

const closureSafety = closure ? assertClosureSafety(process.env) : null;
const apiUrl = closureSafety?.apiUrl ?? "http://localhost:4000";
const siteUrl = closureSafety?.siteUrl ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // booking tests share DB state; run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // single worker to avoid DB conflicts between tests
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: siteUrl,
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
    ...(closure
      ? [
          {
            name: "mobile-chromium",
            testMatch: liveClosureSpecs,
            use: {
              ...devices["iPhone 13"],
              storageState: "e2e/.auth/admin.json",
            },
            dependencies: ["setup"],
          },
        ]
      : []),
  ],

  // Optional: auto-start services if not already running (local dev convenience)
  webServer: [
    {
      command: "pnpm --filter @yezz/api build && node apps/api/dist/index.js",
      cwd: repositoryRoot,
      url: `${apiUrl}/health`,
      timeout: 60_000,
      reuseExistingServer: closure ? false : !process.env.CI,
      env: {
        PORT: new URL(apiUrl).port || "4000",
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
        CORS_ORIGIN: siteUrl,
        ...(closure
          ? {
              EMAIL_FROM: requiredEnvironment("EMAIL_FROM"),
              BOOKING_MAINTENANCE_POLL_MILLISECONDS:
                requiredEnvironment(
                  "BOOKING_MAINTENANCE_POLL_MILLISECONDS",
                ),
              BOOKING_MAINTENANCE_WORKER_ENABLED: requiredEnvironment(
                "BOOKING_MAINTENANCE_WORKER_ENABLED",
              ),
              CUSTOMER_ACTION_TOKEN_SECRET: requiredEnvironment(
                "CUSTOMER_ACTION_TOKEN_SECRET",
              ),
              EMAIL_OUTBOX_POLL_MILLISECONDS: requiredEnvironment(
                "EMAIL_OUTBOX_POLL_MILLISECONDS",
              ),
              EMAIL_OUTBOX_WORKER_ENABLED: "true",
              EMAIL_PROVIDER: "smtp",
              EMAIL_REPLY_TO: requiredEnvironment("EMAIL_REPLY_TO"),
              INTERNAL_REQUEST_ENFORCEMENT: "require",
              OWNER_EMAIL: requiredEnvironment("OWNER_EMAIL"),
              PASSWORD_SETUP_TOKEN_SECRET: requiredEnvironment(
                "PASSWORD_SETUP_TOKEN_SECRET",
              ),
              RATE_LIMIT_HASH_SECRET: requiredEnvironment(
                "RATE_LIMIT_HASH_SECRET",
              ),
              REQUEST_FLOW_EXPERIENCE_ENABLED: requiredEnvironment(
                "REQUEST_FLOW_EXPERIENCE_ENABLED",
              ),
              REQUEST_FLOW_PARTY_ENABLED: requiredEnvironment(
                "REQUEST_FLOW_PARTY_ENABLED",
              ),
              REQUEST_FLOW_PRODUCT_ENABLED: requiredEnvironment(
                "REQUEST_FLOW_PRODUCT_ENABLED",
              ),
              SMTP_HOST: "127.0.0.1",
              SMTP_PORT: requiredEnvironment("SMTP_PORT"),
              WEB_API_SHARED_SECRET: requiredEnvironment(
                "WEB_API_SHARED_SECRET",
              ),
              YEZYY_CLOSURE_RUN_SENTINEL: requiredEnvironment(
                "YEZYY_CLOSURE_RUN_SENTINEL",
              ),
              YEZYY_CLOSURE_E2E: "1",
            }
          : {}),
      },
    },
    {
      command: "pnpm --filter @yezz/web build && pnpm --filter @yezz/web start",
      cwd: repositoryRoot,
      url: siteUrl,
      timeout: 120_000,
      reuseExistingServer: closure ? false : !process.env.CI,
      env: {
        API_URL: closure
          ? requiredEnvironment("API_URL")
          : apiUrl,
        NEXT_PUBLIC_API_URL: closure
          ? requiredEnvironment("NEXT_PUBLIC_API_URL")
          : apiUrl,
        ...(closure
          ? { NEXT_PUBLIC_GA_ID: requiredEnvironment("NEXT_PUBLIC_GA_ID") }
          : {}),
        NEXT_PUBLIC_SITE_URL: closure
          ? requiredEnvironment("NEXT_PUBLIC_SITE_URL")
          : siteUrl,
        NEXT_PUBLIC_USE_API: "true",
        PORT: new URL(siteUrl).port || "3000",
        ...(closure
          ? {
              VERCEL: "1",
              WEB_API_SHARED_SECRET: requiredEnvironment(
                "WEB_API_SHARED_SECRET",
              ),
              YEZYY_CLOSURE_RUN_SENTINEL: requiredEnvironment(
                "YEZYY_CLOSURE_RUN_SENTINEL",
              ),
              YEZYY_CLOSURE_E2E: "1",
            }
          : {}),
      },
    },
  ],
});
