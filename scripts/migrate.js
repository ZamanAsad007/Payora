#!/usr/bin/env node

/**
 * migrate.js
 *
 * Runs all database schema migrations across Payora microservices in proper
 * dependency order. Safe, idempotent, and tracks executed migrations in schema_migrations.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const parsed = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      parsed[key] = val;
    }
  }
  return parsed;
}

const fileEnv = loadEnvFile();
const hostPort = process.env.POSTGRES_PORT || fileEnv.POSTGRES_PORT || "5433";
const dbUrl =
  process.env.DATABASE_URL ||
  fileEnv.DATABASE_URL ||
  `postgresql://${fileEnv.POSTGRES_USER || "postgres"}:${fileEnv.POSTGRES_PASSWORD || "replace-me-postgres-password"}@localhost:${hostPort}/${fileEnv.POSTGRES_DB || "payora_ledger"}`;

// If running on host, ensure port and host match Docker published port
function getResolvedDbUrl() {
  try {
    const url = new URL(dbUrl);
    if (!process.env.DOCKER_CONTAINER) {
      if (url.hostname === "postgres") {
        url.hostname = "localhost";
      }
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        url.port = hostPort;
      }
      return url.toString();
    }
    return dbUrl;
  } catch {
    return dbUrl;
  }
}

const pool = new Pool({
  connectionString: getResolvedDbUrl(),
  connectionTimeoutMillis: 5000,
});

const MIGRATIONS = [
  {
    name: "auth_001_create_auth_schema.sql",
    path: path.join(rootDir, "services/auth-service/migrations/001_create_auth_schema.sql"),
  },
  {
    name: "ledger_001_create_base_ledger_schema.sql",
    path: path.join(rootDir, "services/ledger-service/migrations/001_create_base_ledger_schema.sql"),
  },
  {
    name: "ledger_002_create_top_ups_table.sql",
    path: path.join(rootDir, "services/ledger-service/migrations/002_create_top_ups_table.sql"),
  },
  {
    name: "ledger_003_create_merchants_and_payees.sql",
    path: path.join(rootDir, "services/ledger-service/migrations/003_create_merchants_and_payees.sql"),
  },
  {
    name: "ledger_004_create_limits_and_outbox.sql",
    path: path.join(rootDir, "services/ledger-service/migrations/004_create_limits_and_outbox.sql"),
  },
  {
    name: "ledger_005_create_audit_logs_and_reconciliation.sql",
    path: path.join(rootDir, "services/ledger-service/migrations/005_create_audit_logs_and_reconciliation.sql"),
  },
  {
    name: "notification_001_create_notifications_schema.sql",
    path: path.join(rootDir, "services/notification-service/migrations/001_create_notifications_schema.sql"),
  },
  {
    name: "risk_001_create_risk_schema.sql",
    path: path.join(rootDir, "services/risk-service/migrations/001_create_risk_schema.sql"),
  },
];

async function connectWithRetry(retries = 15, delayMs = 1500) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`[Migration] Waiting for PostgreSQL to accept connections (attempt ${i}/${retries})...`);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function migrate() {
  console.log("==> Running Payora database schema migrations...");
  let client;

  try {
    client = await connectWithRetry();

    await client.query("BEGIN");

    // Ensure schema migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows } = await client.query("SELECT name FROM schema_migrations ORDER BY id ASC");
    const applied = new Set(rows.map((r) => r.name));

    let count = 0;
    for (const m of MIGRATIONS) {
      if (!applied.has(m.name)) {
        console.log(`[Migration] Applying ${m.name}...`);
        if (!fs.existsSync(m.path)) {
          throw new Error(`Migration file not found: ${m.path}`);
        }
        const sql = fs.readFileSync(m.path, "utf-8");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [m.name]);
        count++;
        console.log(`[Migration] Successfully applied ${m.name}`);
      }
    }

    await client.query("COMMIT");

    if (count === 0) {
      console.log("==> Database is already up to date. No new migrations applied.");
    } else {
      console.log(`==> Successfully applied ${count} migration(s).`);
    }
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
    }
    console.error("==> Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate();
