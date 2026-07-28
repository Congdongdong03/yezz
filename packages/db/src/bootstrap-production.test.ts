import { drizzle } from "drizzle-orm/postgres-js";
import { readFile } from "node:fs/promises";
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

    expect(deployScript).toContain(
      "--profile setup up --build migrate bootstrap",
    );
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

      const db = drizzle(integrationClient, {
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
  },
);
