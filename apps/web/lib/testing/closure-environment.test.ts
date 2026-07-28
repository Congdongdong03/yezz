import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildClosureEnvironment } from "../../e2e/closure-environment.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

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

  it("keeps explicit local child values despite an env-file sentinel", () => {
    const sentinelRoot = mkdtempSync(
      path.join(tmpdir(), "yezyy-closure-env-"),
    );
    try {
      writeFileSync(
        path.join(sentinelRoot, ".env.local"),
        [
          "DATABASE_URL=postgres://production.example/yezyy",
          "EMAIL_PROVIDER=resend",
          "SMTP_HOST=smtp.production.example",
          "SMTP_PORT=587",
          "RESEND_API_KEY=production-resend-sentinel",
          "API_URL=https://api.production.example",
          "",
        ].join("\n"),
      );
      const localDatabase =
        "postgres://closure_test:closure_test_only@127.0.0.1:55432/yezyy_closure_test";
      const environment = buildClosureEnvironment(process.env, {
        CLOSURE_SENTINEL_ROOT: sentinelRoot,
        DATABASE_URL: localDatabase,
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "11025",
        YEZYY_CLOSURE_E2E: "1",
      });
      const script = [
        "import { loadEnv as loadDbEnv } from './src/env.ts';",
        "import { loadEnv as loadApiEnv } from '../../apps/api/src/env.ts';",
        "const repoRoot = process.env.CLOSURE_SENTINEL_ROOT;",
        "const loaded = [loadDbEnv({ repoRoot }), loadApiEnv({ repoRoot })];",
        "process.stdout.write(JSON.stringify({ loaded, DATABASE_URL: process.env.DATABASE_URL, EMAIL_PROVIDER: process.env.EMAIL_PROVIDER, SMTP_HOST: process.env.SMTP_HOST, SMTP_PORT: process.env.SMTP_PORT, RESEND_API_KEY: process.env.RESEND_API_KEY, API_URL: process.env.API_URL }));",
      ].join("\n");

      const child = spawnSync(
        "corepack",
        [
          "pnpm",
          "--filter",
          "@yezz/db",
          "exec",
          "tsx",
          "--eval",
          script,
        ],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: environment as NodeJS.ProcessEnv,
        },
      );

      expect(child.status, child.stderr).toBe(0);
      expect(JSON.parse(child.stdout)).toEqual({
        loaded: [false, false],
        DATABASE_URL: localDatabase,
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "11025",
      });
    } finally {
      rmSync(sentinelRoot, { recursive: true, force: true });
    }
  });
});
