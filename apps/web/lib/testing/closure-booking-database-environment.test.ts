import { describe, expect, it } from "vitest";
import { buildClosureBookingDatabaseEnvironment } from "../../e2e/closure-booking-database-environment.mjs";

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
