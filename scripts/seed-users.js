#!/usr/bin/env node

/**
 * seed-users.js
 *
 * Populates fake development users and accounts.
 *
 * SAFETY RULE: Only fake data (e.g. 01700000001, test passwords).
 * Never use real personal or banking data.
 */

import pg from "pg";
import bcrypt from "bcrypt";

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:replace-me-postgres-password@localhost:5432/payora_ledger";

const pool = new Pool({ connectionString: databaseUrl });

const FAKE_USERS = [
  {
    name: "Alice Rahman (Demo User)",
    phone: "01700000001",
    email: "alice.demo@payora.local",
    password: "Password123!",
    pin: "1234",
    role: "USER",
    initialBalancePoisha: 500000n, // 5,000.00 Taka
  },
  {
    name: "Bob Hossain (Demo User)",
    phone: "01700000002",
    email: "bob.demo@payora.local",
    password: "Password123!",
    pin: "4321",
    role: "USER",
    initialBalancePoisha: 200000n, // 2,000.00 Taka
  },
  {
    name: "SuperMart Dhaka (Demo Merchant)",
    phone: "01700000003",
    email: "supermart.demo@payora.local",
    password: "Password123!",
    pin: "9876",
    role: "MERCHANT",
    initialBalancePoisha: 1000000n, // 10,000.00 Taka
  },
];

async function seed() {
  console.log("==> Seeding fake users and demo accounts...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const u of FAKE_USERS) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const pinHash = await bcrypt.hash(u.pin, 10);

      const userRes = await client.query(
        `INSERT INTO users (name, phone, email, password_hash, pin_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (phone) DO UPDATE
         SET name = EXCLUDED.name, pin_hash = EXCLUDED.pin_hash
         RETURNING id`,
        [u.name, u.phone, u.email, passwordHash, pinHash, u.role]
      );

      const userId = userRes.rows[0].id;
      const accountType = u.role === "MERCHANT" ? "MERCHANT_WALLET" : "USER_WALLET";

      await client.query(
        `INSERT INTO accounts (owner_id, type, currency, balance, status)
         VALUES ($1, $2, 'BDT', $3, 'ACTIVE')
         ON CONFLICT DO NOTHING`,
        [userId, accountType, u.initialBalancePoisha.toString()]
      );
    }

    await client.query("COMMIT");
    console.log("==> Seeding completed successfully with fake test users.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("==> Seeding failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
