import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";
import { buildClosureEnvironment } from "./closure-environment.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const compose = [
  "compose",
  "-p",
  `yezyy-closure-${process.pid}-${crypto.randomUUID().slice(0, 8)}`,
  "-f",
  "docker-compose.test.yml",
];
const sharedSecret =
  "closure-e2e-shared-secret-2026-only-local";
const adminEmail = "congdongdong03@gmail.com";
const adminPassword = "Closure-E2E-Admin-2026!";
const rawPlaywrightArguments = process.argv.slice(2);
const playwrightArguments =
  rawPlaywrightArguments[0] === "--"
    ? rawPlaywrightArguments.slice(1)
    : rawPlaywrightArguments;

function availableLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate an isolated closure port"));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: buildClosureEnvironment(process.env, options.env),
    stdio: options.capture
      ? ["ignore", "pipe", "inherit"]
      : "inherit",
    encoding: options.capture ? "utf8" : undefined,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}`,
    );
  }
  return options.capture ? result.stdout.trim() : "";
}

function publishedPort(service, containerPort) {
  const output = run(
    "docker",
    [...compose, "port", service, String(containerPort)],
    { capture: true },
  );
  const match = output.match(/:(\d+)$/);
  if (!match) {
    throw new Error(
      `Unable to resolve ${service} published port from ${output}`,
    );
  }
  return Number(match[1]);
}

function stopServices() {
  run("docker", [...compose, "down", "--volumes", "--remove-orphans"], {
    allowFailure: true,
  });
}

try {
  stopServices();
  run("docker", [...compose, "up", "--detach", "--wait"]);
  const apiPort = await availableLocalPort();
  let webPort = await availableLocalPort();
  while (webPort === apiPort) webPort = await availableLocalPort();
  const postgresPort = publishedPort("postgres", 5432);
  const smtpPort = publishedPort("mailpit", 1025);
  const mailpitApiPort = publishedPort("mailpit", 8025);
  const databaseUrl =
    `postgres://closure_test:closure_test_only@127.0.0.1:${postgresPort}/yezyy_closure_test`;
  run("corepack", ["pnpm", "db:migrate"], {
    env: {
      DATABASE_URL: databaseUrl,
      YEZYY_CLOSURE_E2E: "1",
    },
  });
  run(
    "corepack",
    ["pnpm", "--filter", "@yezz/db", "bootstrap:production"],
    {
      env: {
        ALLOW_PRODUCTION_BOOTSTRAP: "YezYY",
        ADMIN_EMAIL: adminEmail,
        ADMIN_PASSWORD: adminPassword,
        DATABASE_URL: databaseUrl,
        NODE_ENV: "production",
        YEZYY_CLOSURE_E2E: "1",
      },
    },
  );
  run(
    "corepack",
    [
      "pnpm",
      "--filter",
      "@yezz/web",
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.config.ts",
      ...playwrightArguments,
    ],
    {
      env: {
        API_URL: `http://127.0.0.1:${apiPort}`,
        DATABASE_URL: databaseUrl,
        E2E_ADMIN_EMAIL: adminEmail,
        E2E_ADMIN_PASSWORD: adminPassword,
        EMAIL_FROM: "YezYY Closure <closure@closure.test>",
        BOOKING_MAINTENANCE_POLL_MILLISECONDS: "100",
        BOOKING_MAINTENANCE_WORKER_ENABLED: "true",
        CUSTOMER_ACTION_TOKEN_SECRET:
          "closure-e2e-customer-action-secret-local-only",
        EMAIL_OUTBOX_POLL_MILLISECONDS: "100",
        EMAIL_OUTBOX_WORKER_ENABLED: "true",
        EMAIL_PROVIDER: "smtp",
        EMAIL_REPLY_TO: "contact@closure.test",
        INTERNAL_REQUEST_ENFORCEMENT: "require",
        MAILPIT_API_URL: `http://127.0.0.1:${mailpitApiPort}`,
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_PUBLIC_GA_ID: "G-CLOSURE123",
        NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${webPort}`,
        NEXT_PUBLIC_USE_API: "true",
        OWNER_EMAIL: adminEmail,
        RATE_LIMIT_HASH_SECRET:
          "closure-e2e-rate-limit-hash-secret-local-only",
        REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
        REQUEST_FLOW_PARTY_ENABLED: "true",
        REQUEST_FLOW_PRODUCT_ENABLED: "false",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(smtpPort),
        STORE_TIMEZONE: "Australia/Melbourne",
        WEB_API_SHARED_SECRET: sharedSecret,
        YEZYY_CLOSURE_E2E: "1",
      },
    },
  );
} finally {
  stopServices();
}
