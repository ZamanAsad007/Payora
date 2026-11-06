import pg from "pg";
import { getEnv } from "../config/env.js";

const { Pool } = pg;

let poolInstance = null;

export function getPool() {
  if (!poolInstance) {
    const env = getEnv();
    poolInstance = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on("error", (err) => {
      console.error("[Database Pool Error]", err);
    });
  }

  return poolInstance;
}

export async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function getClient() {
  const pool = getPool();
  return pool.connect();
}

export async function closePool() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
