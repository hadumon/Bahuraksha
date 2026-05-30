import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

const { Client } = pg;

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) throw new Error("Set SUPABASE_DB_URL env var");

const migrationsDir = resolve("supabase/migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("Connected to database\n");

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`Running ${file}...`);
    try {
      await client.query(sql);
      console.log(`  OK\n`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  console.log("All migrations completed.");
  await client.end();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
