import { loadEnv } from "./env.js";

loadEnv();
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });

async function main() {
  const tables = await client`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('diy_projects', 'project_categories', 'users', 'bookings')
  `;

  const existingTables = new Set(tables.map((t) => t.table_name));
  console.log("Existing tables:", Array.from(existingTables).join(", ") || "none");

  const criticalTables = ["diy_projects", "project_categories", "users", "bookings"];
  const missing = criticalTables.filter((t) => !existingTables.has(t));

  if (missing.length > 0) {
    console.warn("Missing critical tables:", missing.join(", "));
    const migrationTable = await client`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
    `;
    if (migrationTable.length > 0) {
      console.log("Resetting drizzle_migrations to force re-run...");
      await client`DELETE FROM "__drizzle_migrations"`;
      console.log("Migration records cleared.");
    } else {
      console.log("No drizzle_migrations table found — fresh start.");
    }
  }

  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied successfully");
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  client.end().catch(() => {});
  process.exit(1);
});
