import { loadEnv } from "./env.js";

loadEnv();
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });

async function main() {
  // Check if critical tables are missing despite migration records
  const tables = await client`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;

  const existingTables = new Set(tables.map((t) => t.table_name));
  console.log("Existing tables:", Array.from(existingTables).join(", ") || "none");

  const criticalTables = ["diy_projects", "project_categories", "users", "bookings"];
  const missing = criticalTables.filter((t) => !existingTables.has(t));

  // Check for partial migration state: tables from pending migrations already exist
  let hasPartialState = missing.length > 0;
  if (!hasPartialState) {
    const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
    const pendingTables: string[] = [];
    try {
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const entries = journal.entries || [];

      // Get recorded migration count from drizzle schema (where drizzle-orm stores it)
      let recordedCount = 0;
      try {
        const result = await client`SELECT COUNT(*) as count FROM "drizzle"."__drizzle_migrations"`;
        recordedCount = Number(result[0]?.count || 0);
      } catch {
        // __drizzle_migrations doesn't exist in drizzle schema
      }

      // Check pending migrations for tables they would create
      const pendingEntries = entries.slice(recordedCount);
      for (const entry of pendingEntries) {
        const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
        try {
          const sql = fs.readFileSync(sqlPath, "utf-8");
          const matches = sql.match(/CREATE TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi) || [];
          for (const match of matches) {
            const tableName = match.match(/"([^"]+)"/)?.[1];
            if (tableName) pendingTables.push(tableName);
          }
        } catch {}
      }
    } catch {}

    const conflictingTables = pendingTables.filter((t) => existingTables.has(t));
    if (conflictingTables.length > 0) {
      console.warn("Tables from pending migrations already exist:", conflictingTables.join(", "));
      hasPartialState = true;
    }
  }

  if (hasPartialState) {
    if (missing.length > 0) {
      console.warn("Missing critical tables:", missing.join(", "));
    }

    // If some tables exist but critical ones are missing, the DB is in a partial state.
    // Drop all existing public tables to get a clean slate.
    if (existingTables.size > 0) {
      console.log("Database is in partial state. Dropping all existing public tables...");
      for (const table of existingTables) {
        if (table === "__drizzle_migrations") continue;
        console.log(`  Dropping ${table}...`);
        await client`DROP TABLE IF EXISTS ${client(table)} CASCADE`;
      }
      console.log("All existing tables dropped.");
    }

    // Also clear drizzle migration records if the table exists (in drizzle schema)
    const migrationTable = await client`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    `;
    if (migrationTable.length > 0) {
      console.log("Resetting drizzle_migrations to force re-run...");
      await client`DELETE FROM "drizzle"."__drizzle_migrations"`;
      console.log("Migration records cleared.");
    } else {
      console.log("No drizzle_migrations table found — fresh start.");
    }

    // Drop existing custom types in public schema so migrations can recreate them
    const existingTypes = await client`
      SELECT typname FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
    `;
    if (existingTypes.length > 0) {
      console.log("Dropping existing enum types...");
      for (const t of existingTypes) {
        console.log(`  Dropping type ${t.typname}...`);
        await client`DROP TYPE IF EXISTS ${client(t.typname)} CASCADE`;
      }
      console.log("Enum types dropped.");
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
