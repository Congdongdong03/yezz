import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { createDb, type Db } from "./client.js";
import { loadEnv } from "./env.js";
import { siteSettings, users } from "./schema/index.js";

export type ProductionBootstrapEnv = Record<string, string | undefined>;

type SiteSettingsInsert = typeof siteSettings.$inferInsert;
type AdminInsert = typeof users.$inferInsert;

export type ProductionBootstrapStore = {
  transaction<T>(
    operation: (store: ProductionBootstrapStore) => Promise<T>,
  ): Promise<T>;
  acquireBootstrapLock(): Promise<void>;
  hasSiteSettings(): Promise<boolean>;
  createSiteSettings(settings: SiteSettingsInsert): Promise<void>;
  hasAdmin(): Promise<boolean>;
  createAdmin(admin: AdminInsert): Promise<void>;
};

type BootstrapOptions = {
  store?: ProductionBootstrapStore;
  hashPassword?: (password: string, rounds: number) => Promise<string>;
};

export type ProductionBootstrapResult = {
  settingsCreated: boolean;
  adminCreated: boolean;
};

const PLACEHOLDER_PASSWORDS = new Set([
  "admin",
  "changeme",
  "change_me_in_env",
  "password",
  "your-strong-password",
  "your-very-strong-password",
]);

const PLACEHOLDER_EMAILS = new Set([
  "admin@yezz.local",
  "admin@example.com",
  "your-email@example.com",
]);

const TRUTHFUL_SETTINGS: SiteSettingsInsert = {
  storeName: "YezYY",
  address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  businessHours:
    "Monday 9:30 am–5:00 pm; Tuesday 9:30 am–5:00 pm; Wednesday 9:30 am–5:00 pm; Thursday 9:30 am–8:30 pm; Friday 9:30 am–8:30 pm; Saturday 9:30 am–5:30 pm; Sunday 10:00 am–5:00 pm",
  phone: "0430 787 712",
  email: "congdongdong03@gmail.com",
  wechatId: null,
  wechatQrUrl: null,
  heroImageUrl: null,
  instagram: null,
  xiaohongshu: "95848743904",
  googleMapUrl:
    "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
  seoTitle: "YezYY",
  seoDescription:
    "A DIY studio in Glen Waverley for creative experiences, dates, birthdays, and gatherings.",
};

export function createBootstrapStore(db: Db): ProductionBootstrapStore {
  return {
    transaction(operation) {
      return db.transaction((transaction) =>
        operation(createBootstrapStore(transaction as unknown as Db)),
      );
    },
    async acquireBootstrapLock() {
      await db.execute(
        sql`select pg_advisory_xact_lock(149978, 1125)`,
      );
    },
    async hasSiteSettings() {
      const [row] = await db
        .select({ id: siteSettings.id })
        .from(siteSettings)
        .limit(1);
      return Boolean(row);
    },
    async createSiteSettings(settings) {
      await db.insert(siteSettings).values(settings);
    },
    async hasAdmin() {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);
      return Boolean(row);
    },
    async createAdmin(admin) {
      await db.insert(users).values(admin);
    },
  };
}

function requireFirstAdminCredentials(env: ProductionBootstrapEnv) {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? "";

  if (!email) {
    throw new Error("ADMIN_EMAIL is required when no admin exists.");
  }
  if (!password) {
    throw new Error("ADMIN_PASSWORD is required when no admin exists.");
  }
  if (
    !email.includes("@") ||
    PLACEHOLDER_EMAILS.has(email) ||
    email.endsWith(".local") ||
    email.endsWith("@example.com") ||
    email.endsWith("@example.test")
  ) {
    throw new Error("Refusing placeholder credentials for the first admin.");
  }
  if (PLACEHOLDER_PASSWORDS.has(password.trim().toLowerCase())) {
    throw new Error("Refusing placeholder credentials for the first admin.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  return { email, password };
}

async function bootstrapWithStore(
  env: ProductionBootstrapEnv,
  store: ProductionBootstrapStore,
  hashPassword: (password: string, rounds: number) => Promise<string>,
): Promise<ProductionBootstrapResult> {
  return store.transaction(async (transaction) => {
    await transaction.acquireBootstrapLock();
    let settingsCreated = false;
    let adminCreated = false;

    if (!(await transaction.hasSiteSettings())) {
      await transaction.createSiteSettings(TRUTHFUL_SETTINGS);
      settingsCreated = true;
    }

    if (!(await transaction.hasAdmin())) {
      const { email, password } = requireFirstAdminCredentials(env);
      const passwordHash = await hashPassword(password, 12);
      await transaction.createAdmin({
        email,
        passwordHash,
        name: "YezYY Admin",
        role: "admin",
      });
      adminCreated = true;
    }

    return { settingsCreated, adminCreated };
  });
}

export async function bootstrapProduction(
  env: ProductionBootstrapEnv = process.env,
  options: BootstrapOptions = {},
): Promise<ProductionBootstrapResult> {
  if (env.ALLOW_PRODUCTION_BOOTSTRAP !== "YezYY") {
    throw new Error(
      "Production bootstrap requires ALLOW_PRODUCTION_BOOTSTRAP=YezYY.",
    );
  }

  const hashPassword = options.hashPassword ?? bcrypt.hash;
  if (options.store) {
    return bootstrapWithStore(env, options.store, hashPassword);
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for production bootstrap.");
  }

  const { db, client } = createDb(databaseUrl);
  try {
    return await bootstrapWithStore(
      env,
      createBootstrapStore(db),
      hashPassword,
    );
  } finally {
    await client.end();
  }
}

async function runFromCommandLine() {
  loadEnv();
  const result = await bootstrapProduction(process.env);
  console.log(
    `Production bootstrap complete (settings: ${result.settingsCreated ? "created" : "existing"}, admin: ${result.adminCreated ? "created" : "existing"}).`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runFromCommandLine().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown production bootstrap error";
    console.error(message);
    process.exitCode = 1;
  });
}
