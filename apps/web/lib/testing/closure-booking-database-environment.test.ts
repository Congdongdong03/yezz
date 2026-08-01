import { describe, expect, it } from "vitest";
import {
  buildClosureBookingDatabaseEnvironment,
  buildClosureLiveInitializationEnvironment,
  buildClosureMigrationDatabaseEnvironment,
} from "../../e2e/closure-booking-database-environment.mjs";

describe("closure booking database child environment", () => {
  it("uses an isolated test database without inheriting ambient credentials", () => {
    const testDatabaseUrl =
      "postgres://closure_test:closure_test_only@127.0.0.1:55432/yezyy_closure_test";

    const environment = buildClosureBookingDatabaseEnvironment(
      {
        DATABASE_URL: "postgres://production.example/yezyy",
        RESEND_API_KEY: "ambient-production-resend-credential",
        SMTP_PASSWORD: "ambient-production-smtp-password",
      },
      testDatabaseUrl,
    );

    expect(environment).toMatchObject({
      TEST_DATABASE_URL: testDatabaseUrl,
      YEZZY_CLOSURE_E2E: "1",
    });
    expect(environment.DATABASE_URL).not.toBe(testDatabaseUrl);
    expect(new URL(environment.DATABASE_URL!).hostname).toBe("127.0.0.1");
    expect(new URL(environment.DATABASE_URL!).pathname).toBe(
      "/yezyy_closure_test",
    );
    expect(environment).not.toHaveProperty("RESEND_API_KEY");
    expect(environment).not.toHaveProperty("SMTP_PASSWORD");
  });
});

describe("closure migration database child environment", () => {
  it("enables only database-package integration tests against the owned URL", () => {
    const testDatabaseUrl =
      "postgres://closure_test:closure_test_only@127.0.0.1:55432/yezyy_closure_test";

    const environment = buildClosureMigrationDatabaseEnvironment(
      {
        DATABASE_URL: "postgres://production.example/yezyy",
        RESEND_API_KEY: "ambient-production-resend-credential",
      },
      testDatabaseUrl,
    );

    expect(environment).toMatchObject({
      TEST_DATABASE_URL: testDatabaseUrl,
      YEZZY_CLOSURE_E2E: "1",
      YEZYY_RUN_DB_MIGRATION_TESTS: "1",
    });
    expect(environment.DATABASE_URL).not.toBe(testDatabaseUrl);
    expect(new URL(environment.DATABASE_URL!).hostname).toBe("127.0.0.1");
    expect(environment).not.toHaveProperty("RESEND_API_KEY");
  });
});

describe("closure live-initialization child environment", () => {
  it("supplies the explicit approvals required by the real seed and bootstrap commands", () => {
    const environment = buildClosureLiveInitializationEnvironment(
      {
        DATABASE_URL: "postgres://production.example/yezyy",
        RESEND_API_KEY: "ambient-production-resend-credential",
      },
      "postgres://closure_test:closure_test_only@127.0.0.1:55432/yezyy_closure_test",
    );

    expect(environment).toMatchObject({
      ALLOW_PRODUCTION_BOOTSTRAP: "YezYY",
      CONFIRM_LIVE_CATALOGUE_SEED: "YezYY",
      PASSWORD_SETUP_TOKEN_SECRET:
        "closure-booking-db-password-setup-token-secret-local-only",
      YEZZY_CLOSURE_E2E: "1",
    });
    expect(new URL(environment.DATABASE_URL!).hostname).toBe("127.0.0.1");
    expect(environment).not.toHaveProperty("RESEND_API_KEY");
  });
});
