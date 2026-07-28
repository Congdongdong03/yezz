import { drizzle } from "drizzle-orm/postgres-js";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapProduction,
  createBootstrapStore,
  type ProductionBootstrapStore,
} from "./bootstrap-production.js";
import type { Db } from "./client.js";
import * as databaseSchema from "./schema/index.js";
import { assertDemoSeedAllowed } from "./seed-safety.js";

type BootstrapState = {
  settings: Array<Record<string, unknown>>;
  admins: Array<Record<string, unknown>>;
  categories: number;
  projects: number;
  parties: number;
  gallery: number;
};

function createState(): BootstrapState {
  return {
    settings: [],
    admins: [],
    categories: 0,
    projects: 0,
    parties: 0,
    gallery: 0,
  };
}

function createStore(state: BootstrapState): ProductionBootstrapStore {
  const store: ProductionBootstrapStore = {
    transaction: async (operation) => operation(store),
    acquireBootstrapLock: async () => undefined,
    hasSiteSettings: async () => state.settings.length > 0,
    createSiteSettings: async (settings) => {
      state.settings.push(settings);
    },
    hasAdmin: async () => state.admins.length > 0,
    createAdmin: async (admin) => {
      state.admins.push(admin);
    },
  };
  return store;
}

const guardedEnv = {
  ALLOW_PRODUCTION_BOOTSTRAP: "YezYY",
  ADMIN_EMAIL: "Congdongdong03@Gmail.com",
  ADMIN_PASSWORD: "a-strong-owner-password",
};

const runDatabaseTests = process.env.YEZYY_RUN_DB_MIGRATION_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
let integrationClient: Sql | undefined;
let applicationClient: Sql | undefined;
let integrationSchema: string | undefined;

function requireSafeTestDatabaseUrl() {
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_DB_MIGRATION_TESTS=1",
    );
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Bootstrap tests refuse TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }
  const databaseName = decodeURIComponent(
    new URL(testDatabaseUrl).pathname.slice(1),
  );
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Bootstrap tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return testDatabaseUrl;
}

function withSearchPath(url: string, schemaName: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-csearch_path=${schemaName}`);
  return parsed.toString();
}

async function applyMigration(
  client: Sql,
  schemaName: string,
  migrationName: string,
) {
  const source = await readFile(
    `${migrationsDirectory}${migrationName}`,
    "utf8",
  );
  const statements = source
    .replaceAll('"public".', `"${schemaName}".`)
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await client.unsafe(`SET search_path TO "${schemaName}"`);
  for (const statement of statements) {
    await client.unsafe(statement);
  }
}

afterEach(async () => {
  await applicationClient?.end();
  applicationClient = undefined;
  if (!integrationClient) return;
  if (integrationSchema) {
    await integrationClient.unsafe(
      `DROP SCHEMA IF EXISTS "${integrationSchema}" CASCADE`,
    );
  }
  await integrationClient.end();
  integrationClient = undefined;
  integrationSchema = undefined;
});

describe("production bootstrap", () => {
  it("refuses to run the demo seed in production", () => {
    expect(() => assertDemoSeedAllowed("production")).toThrow(
      "demo seed is disabled in production",
    );
    expect(() => assertDemoSeedAllowed("development")).not.toThrow();
  });

  it("wires production setup to migrate then bootstrap without demo seed", async () => {
    const [deployScript, productionCompose] = await Promise.all([
      readFile(`${repositoryRoot}deploy.sh`, "utf8"),
      readFile(`${repositoryRoot}docker-compose.prod.yml`, "utf8"),
    ]);

    expect(deployScript).toContain("--profile setup build migrate bootstrap");
    expect(deployScript).toContain("run --rm migrate");
    expect(deployScript).toContain(
      "--profile setup run --rm --no-deps bootstrap",
    );
    expect(deployScript).not.toContain(
      "--profile setup up --build migrate bootstrap",
    );
    expect(deployScript).not.toContain("grep -v '^#' .env | xargs");
    expect(productionCompose).toContain(
      'command: ["sh", "-c", "pnpm --filter @yezz/db bootstrap:production"]',
    );
    expect(productionCompose).toMatch(
      /bootstrap:[\s\S]*depends_on:[\s\S]*migrate:[\s\S]*condition: service_completed_successfully/,
    );
    expect(`${deployScript}\n${productionCompose}`).not.toMatch(
      /db:seed|seed:dev-demo|FORCE_SEED/,
    );
  });

  it("loads documented quoted environment values without splitting them", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yezyy-env-test-"));
    const envPath = join(directory, ".env");
    try {
      await writeFile(
        envPath,
        [
          'EMAIL_FROM="YezYY <bookings@yezyy.com>"',
          'ADMIN_PASSWORD="strong password with spaces"',
        ].join("\n"),
      );
      const result = spawnSync(
        "bash",
        [
          "-c",
          'set -a; . "$1"; set +a; printf "%s\\n%s" "$EMAIL_FROM" "$ADMIN_PASSWORD"',
          "bash",
          envPath,
        ],
        { encoding: "utf8" },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(
        "YezYY <bookings@yezyy.com>\nstrong password with spaces",
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("the real demo-seed command refuses production before database access", () => {
    const result = spawnSync(
      "corepack",
      ["pnpm", "--filter", "@yezz/db", "seed:dev-demo"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL:
            "postgres://invalid:invalid@127.0.0.1:1/must_not_connect",
          NODE_ENV: "production",
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "demo seed is disabled in production",
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(
      "ECONNREFUSED",
    );
  });

  it("creates truthful settings and one admin without catalogue demo rows", async () => {
    const state = createState();
    const hashPassword = vi.fn(async () => "safe-hash");

    const result = await bootstrapProduction(guardedEnv, {
      store: createStore(state),
      hashPassword,
    });

    expect(result).toEqual({ adminCreated: true, settingsCreated: true });
    expect({
      settings: state.settings.length,
      admins: state.admins.length,
      categories: state.categories,
      projects: state.projects,
      parties: state.parties,
      gallery: state.gallery,
    }).toEqual({
      settings: 1,
      admins: 1,
      categories: 0,
      projects: 0,
      parties: 0,
      gallery: 0,
    });
    expect(state.settings[0]).toMatchObject({
      storeName: "YezYY",
      address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
      phone: "0430 787 712",
      email: "congdongdong03@gmail.com",
      xiaohongshu: "95848743904",
    });
    expect(state.admins[0]).toMatchObject({
      email: "congdongdong03@gmail.com",
      passwordHash: "safe-hash",
      name: "YezYY Admin",
      role: "admin",
    });
    expect(hashPassword).toHaveBeenCalledWith(
      "a-strong-owner-password",
      12,
    );
  });

  it("is idempotent and does not require credentials when an admin exists", async () => {
    const state = createState();
    state.admins.push({ email: "existing@example.com" });
    const store = createStore(state);

    await bootstrapProduction(
      { ALLOW_PRODUCTION_BOOTSTRAP: "YezYY" },
      { store },
    );
    const second = await bootstrapProduction(
      { ALLOW_PRODUCTION_BOOTSTRAP: "YezYY" },
      { store },
    );

    expect(second).toEqual({ adminCreated: false, settingsCreated: false });
    expect(state.settings).toHaveLength(1);
    expect(state.admins).toHaveLength(1);
  });

  it("rejects a missing guard before touching the store", async () => {
    const state = createState();
    const store = createStore(state);
    const transaction = vi.spyOn(store, "transaction");

    await expect(
      bootstrapProduction(
        {
          ADMIN_EMAIL: guardedEnv.ADMIN_EMAIL,
          ADMIN_PASSWORD: guardedEnv.ADMIN_PASSWORD,
        },
        { store },
      ),
    ).rejects.toThrow("ALLOW_PRODUCTION_BOOTSTRAP=YezYY");
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...guardedEnv, ADMIN_PASSWORD: "changeme" }, "placeholder credentials"],
    [{ ...guardedEnv, ADMIN_PASSWORD: "your-strong-password" }, "placeholder credentials"],
    [{ ...guardedEnv, ADMIN_PASSWORD: "short" }, "at least 12 characters"],
    [{ ...guardedEnv, ADMIN_EMAIL: "admin@yezz.local" }, "placeholder credentials"],
    [{ ...guardedEnv, ADMIN_EMAIL: "" }, "ADMIN_EMAIL"],
    [{ ...guardedEnv, ADMIN_PASSWORD: "" }, "ADMIN_PASSWORD"],
  ])("rejects unsafe first-admin credentials", async (env, message) => {
    await expect(
      bootstrapProduction(env, { store: createStore(createState()) }),
    ).rejects.toThrow(message);
  });
});

describe.skipIf(!runDatabaseTests)(
  "production bootstrap PostgreSQL integration",
  () => {
    it("creates only settings/admin and remains idempotent", async () => {
      integrationClient = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      integrationSchema = `yezyy_bootstrap_test_${crypto.randomUUID().replaceAll("-", "")}`;
      await integrationClient.unsafe(`CREATE SCHEMA "${integrationSchema}"`);
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0000_ordinary_captain_britain.sql",
      );
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0001_nice_ezekiel.sql",
      );
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0002_yezyy_flow_closure.sql",
      );

      applicationClient = postgres(
        withSearchPath(requireSafeTestDatabaseUrl(), integrationSchema),
        { max: 2 },
      );
      const db = drizzle(applicationClient, {
        schema: databaseSchema,
      }) as unknown as Db;
      const store = createBootstrapStore(db);
      const options = {
        store,
        hashPassword: async () => "integration-safe-hash",
      };

      expect(await bootstrapProduction(guardedEnv, options)).toEqual({
        adminCreated: true,
        settingsCreated: true,
      });
      expect(await bootstrapProduction(guardedEnv, options)).toEqual({
        adminCreated: false,
        settingsCreated: false,
      });

      const [counts] = await integrationClient<{
        settings: number;
        admins: number;
        categories: number;
        projects: number;
        parties: number;
        gallery: number;
      }[]>`
        SELECT
          (SELECT count(*)::int FROM site_settings) AS settings,
          (SELECT count(*)::int FROM users WHERE role = 'admin') AS admins,
          (SELECT count(*)::int FROM project_categories) AS categories,
          (SELECT count(*)::int FROM diy_projects) AS projects,
          (SELECT count(*)::int FROM party_packages) AS parties,
          (SELECT count(*)::int FROM gallery_images) AS gallery
      `;
      expect(counts).toEqual({
        settings: 1,
        admins: 1,
        categories: 0,
        projects: 0,
        parties: 0,
        gallery: 0,
      });
    });

    it("serializes concurrent first-admin bootstraps", async () => {
      integrationClient = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      integrationSchema = `yezyy_bootstrap_test_${crypto.randomUUID().replaceAll("-", "")}`;
      await integrationClient.unsafe(`CREATE SCHEMA "${integrationSchema}"`);
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0000_ordinary_captain_britain.sql",
      );
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0001_nice_ezekiel.sql",
      );
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0002_yezyy_flow_closure.sql",
      );

      applicationClient = postgres(
        withSearchPath(requireSafeTestDatabaseUrl(), integrationSchema),
        { max: 2 },
      );
      const db = drizzle(applicationClient, {
        schema: databaseSchema,
      }) as unknown as Db;
      const store = createBootstrapStore(db);
      const options = {
        store,
        hashPassword: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return "integration-safe-hash";
        },
      };

      const results = await Promise.all([
        bootstrapProduction(guardedEnv, options),
        bootstrapProduction(
          { ...guardedEnv, ADMIN_EMAIL: "second-owner@yezyy.com" },
          options,
        ),
      ]);
      expect(
        results.filter(
          ({ adminCreated, settingsCreated }) =>
            adminCreated && settingsCreated,
        ),
      ).toHaveLength(1);

      const [counts] = await integrationClient<{
        settings: number;
        admins: number;
      }[]>`
        SELECT
          (SELECT count(*)::int FROM site_settings) AS settings,
          (SELECT count(*)::int FROM users WHERE role = 'admin') AS admins
      `;
      expect(counts).toEqual({ settings: 1, admins: 1 });
    });

    it("runs the real development demo seed against an isolated schema", async () => {
      integrationClient = postgres(requireSafeTestDatabaseUrl(), { max: 1 });
      integrationSchema = `yezyy_demo_seed_test_${crypto.randomUUID().replaceAll("-", "")}`;
      await integrationClient.unsafe(`CREATE SCHEMA "${integrationSchema}"`);
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0000_ordinary_captain_britain.sql",
      );
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0001_nice_ezekiel.sql",
      );
      await applyMigration(
        integrationClient,
        integrationSchema,
        "0002_yezyy_flow_closure.sql",
      );

      const result = spawnSync(
        "corepack",
        ["pnpm", "--filter", "@yezz/db", "seed:dev-demo"],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            ADMIN_EMAIL: "demo-admin@yezyy.test",
            ADMIN_PASSWORD: "development-only-password",
            DATABASE_URL: withSearchPath(
              requireSafeTestDatabaseUrl(),
              integrationSchema,
            ),
            FORCE_SEED: "1",
            NODE_ENV: "development",
          },
        },
      );
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

      await integrationClient.unsafe(
        `SET search_path TO "${integrationSchema}"`,
      );
      const [counts] = await integrationClient<{
        categories: number;
        projects: number;
        parties: number;
      }[]>`
        SELECT
          (SELECT count(*)::int FROM project_categories) AS categories,
          (SELECT count(*)::int FROM diy_projects) AS projects,
          (SELECT count(*)::int FROM party_packages) AS parties
      `;
      expect(counts.categories).toBeGreaterThan(0);
      expect(counts.projects).toBeGreaterThan(0);
      expect(counts.parties).toBeGreaterThan(0);
    });
  },
);
