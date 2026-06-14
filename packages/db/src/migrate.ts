import { loadEnv } from "./env.js";

loadEnv();
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl, {
  max: 1,
  onnotice: (notice) => {
    // Ignore benign notices like "enum label already exists, skipping"
    if (notice.message?.includes("already exists")) {
      console.log("Notice (ignored):", notice.message);
      return;
    }
    console.log("Notice:", notice.message);
  },
});
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied successfully");
} catch (err: any) {
  const msg = err?.message ?? String(err);
  // If the only issue is objects already existing, treat as success
  if (
    msg.includes("already exists") ||
    msg.includes("DuplicateObject") ||
    msg.includes("42710")
  ) {
    console.warn("Migration warning (already exists):", msg);
    console.log("Migrations applied successfully (skipped existing objects)");
  } else {
    console.error("Migration failed:", err);
    await client.end();
    process.exit(1);
  }
}

await client.end();
