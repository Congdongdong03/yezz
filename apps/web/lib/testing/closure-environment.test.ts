import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { buildClosureEnvironment } from "../../e2e/closure-environment.mjs";

describe("closure E2E child environment", () => {
  it("cannot inherit an ambient Resend credential", () => {
    const environment = buildClosureEnvironment(
      {
        RESEND_API_KEY: "ambient-production-resend-credential",
        DATABASE_URL: "postgres://production.example/yezyy",
        SMTP_PASSWORD: "production-smtp-password",
        SENDGRID_API_KEY: "production-api-key",
      },
      {
        DATABASE_URL:
          "postgres://closure_test:closure_test_only@127.0.0.1:55432/yezyy_closure_test",
        EMAIL_PROVIDER: "smtp",
      },
    );

    const child = spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify(process.env))",
      ],
      {
        encoding: "utf8",
        env: environment as NodeJS.ProcessEnv,
      },
    );
    expect(child.status).toBe(0);
    const effectiveEnvironment = JSON.parse(child.stdout) as NodeJS.ProcessEnv;

    expect(effectiveEnvironment).not.toHaveProperty("RESEND_API_KEY");
    expect(effectiveEnvironment).not.toHaveProperty("SMTP_PASSWORD");
    expect(effectiveEnvironment).not.toHaveProperty("SENDGRID_API_KEY");
    expect(effectiveEnvironment).toMatchObject({
      DATABASE_URL:
        "postgres://closure_test:closure_test_only@127.0.0.1:55432/yezyy_closure_test",
      EMAIL_PROVIDER: "smtp",
    });
  });
});
