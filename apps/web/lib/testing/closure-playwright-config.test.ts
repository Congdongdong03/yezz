import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function loadClosureConfig(overrides: Record<string, string>) {
  return spawnSync(
    "corepack",
    [
      "pnpm",
      "exec",
      "playwright",
      "test",
      "--list",
      "--config",
      "playwright.config.ts",
    ],
    {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        YEZYY_CLOSURE_E2E: "1",
        YEZYY_CLOSURE_RUN_SENTINEL: "a".repeat(64),
        API_URL: "http://127.0.0.1:4011",
        DATABASE_URL:
          "postgres://closure_test:closure_test_only@127.0.0.1:55432/yezyy_closure_test",
        EMAIL_FROM: "YezYY Closure <closure@closure.test>",
        EMAIL_REPLY_TO: "contact@closure.test",
        OWNER_EMAIL: "owner@closure.test",
        BOOKING_MAINTENANCE_POLL_MILLISECONDS: "100",
        BOOKING_MAINTENANCE_WORKER_ENABLED: "true",
        CUSTOMER_ACTION_TOKEN_SECRET: "closure-e2e-customer-action-secret-local-only",
        EMAIL_OUTBOX_POLL_MILLISECONDS: "100",
        RATE_LIMIT_HASH_SECRET: "closure-e2e-rate-limit-hash-secret-local-only",
        REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
        REQUEST_FLOW_PARTY_ENABLED: "true",
        REQUEST_FLOW_PRODUCT_ENABLED: "false",
        SMTP_PORT: "1025",
        WEB_API_SHARED_SECRET: "closure-e2e-shared-secret-2026-only-local",
        NEXT_PUBLIC_GA_ID: "G-CLOSURE123",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:4011",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3011",
        ...overrides,
      },
    },
  );
}

describe("closure Playwright configuration", () => {
  it.each([
    ["production API", { API_URL: "https://api.yezyy.com" }],
    ["non-loopback API", { API_URL: "http://192.0.2.7:4011" }],
    [
      "mismatched API origins",
      { API_URL: "http://127.0.0.1:4012" },
    ],
    ["missing runner sentinel", { YEZYY_CLOSURE_RUN_SENTINEL: "" }],
  ])("rejects %s", (_name, overrides) => {
    const result = loadClosureConfig(overrides);

    expect(result.status, result.stderr).not.toBe(0);
  });
});
