import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "../db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../migrations");

export async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows } = await client.query("SELECT name FROM schema_migrations ORDER BY id ASC");
    const appliedSet = new Set(rows.map((r) => r.name));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      if (!appliedSet.has(file)) {
        console.log(`[Auth Migration] Applying ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf-8");

        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        appliedCount += 1;
        console.log(`[Auth Migration] Applied ${file}`);
      }
    }

    await client.query("COMMIT");
    if (appliedCount === 0) {
      console.log("[Auth Migration] Schema is up to date.");
    } else {
      console.log(`[Auth Migration] Applied ${appliedCount} migration(s).`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Auth Migration Error]:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async () => {
      await closePool();
      process.exit(1);
    });
}
