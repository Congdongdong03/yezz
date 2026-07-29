import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildClosureEnvironment } from "./closure-environment.mjs";
import {
  buildClosureBookingDatabaseEnvironment,
  buildClosureLiveInitializationEnvironment,
  buildClosureMigrationDatabaseEnvironment,
} from "./closure-booking-database-environment.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const compose = [
  "compose",
  "-p",
  `yezyy-booking-db-${process.pid}-${crypto.randomUUID().slice(0, 8)}`,
  "-f",
  "docker-compose.test.yml",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: buildClosureEnvironment(process.env, options.env),
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: options.capture ? "utf8" : undefined,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
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

function assertInitializedData() {
  const output = run(
    "docker",
    [
      ...compose,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "closure_test",
      "-d",
      "yezyy_closure_test",
      "-tAc",
      "SELECT (SELECT count(*) FROM site_settings), (SELECT count(*) FROM users WHERE role = 'owner' AND email = 'congdongdong03@gmail.com'), (SELECT count(*) FROM project_categories), (SELECT count(*) FROM diy_projects), (SELECT count(*) FROM party_packages)",
    ],
    { capture: true },
  );
  const counts = output.split("|").map(Number);
  if (
    counts.length !== 5 ||
    counts[0] !== 1 ||
    counts[1] !== 1 ||
    counts.slice(2).some((count) => !Number.isInteger(count) || count < 1)
  ) {
    throw new Error(`Live initialization verification failed: ${output}`);
  }
}

try {
  stopServices();
  run("docker", [...compose, "up", "--detach", "--wait", "postgres"]);
  const postgresPort = publishedPort("postgres", 5432);
  const databaseUrl =
    `postgres://closure_test:closure_test_only@127.0.0.1:${postgresPort}/yezyy_closure_test`;

  run("corepack", ["pnpm", "db:migrate"], {
    env: {
      DATABASE_URL: databaseUrl,
      YEZZY_CLOSURE_E2E: "1",
    },
  });
  const liveInitializationEnvironment = buildClosureLiveInitializationEnvironment(
    process.env,
    databaseUrl,
  );
  run("corepack", ["pnpm", "--filter", "@yezz/db", "seed:live-booking"], {
    env: liveInitializationEnvironment,
  });
  run("corepack", ["pnpm", "--filter", "@yezz/db", "bootstrap:production"], {
    env: liveInitializationEnvironment,
  });
  assertInitializedData();
  run("corepack", ["pnpm", "--filter", "@yezz/db", "test:integration"], {
    env: buildClosureMigrationDatabaseEnvironment(process.env, databaseUrl),
  });
  run("corepack", ["pnpm", "test:api:booking-db"], {
    env: buildClosureBookingDatabaseEnvironment(process.env, databaseUrl),
  });
} finally {
  stopServices();
}
