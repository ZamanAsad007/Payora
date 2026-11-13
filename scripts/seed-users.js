#!/usr/bin/env node

/**
 * seed-users.js
 *
 * Populates realistic development seed data:
 * - Regular Users (Alice, Bob) with initial balances & transaction PINs
 * - Merchant (SuperMart Dhaka) with QR code & merchant account
 * - Agent (Karim Agent Point) for Cash-Out operations
 * - System Auditor / Administrator (Admin) for Admin Dashboard
 * - System accounts (Bank Clearing, Fee Revenue, Agent Cash)
 * - Saved payees & transfer limits
 *
 * SAFETY RULE: Only fake demo data. Never use real personal or banking data.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// 1. Safe bcrypt resolver
let bcrypt;
try {
  bcrypt = (await import("bcrypt")).default;
} catch {
  bcrypt = (await import("../services/auth-service/node_modules/bcrypt/bcrypt.js")).default;
}

// 2. Load .env fallback if DATABASE_URL is not set
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

const FAKE_USERS = [
  {
    name: "Alice Rahman (Demo User)",
    phone: "01700000001",
    email: "alice.demo@payora.local",
    password: "Password123!",
    pin: "1234",
    role: "USER",
    initialBalancePoisha: 500000n, // ৳ 5,000.00
  },
  {
    name: "Bob Hossain (Demo User)",
    phone: "01700000002",
    email: "bob.demo@payora.local",
    password: "Password123!",
    pin: "4321",
    role: "USER",
    initialBalancePoisha: 200000n, // ৳ 2,000.00
  },
  {
    name: "SuperMart Dhaka (Demo Merchant)",
    phone: "01700000003",
    email: "supermart.demo@payora.local",
    password: "Password123!",
    pin: "9876",
    role: "MERCHANT",
    initialBalancePoisha: 1000000n, // ৳ 10,000.00
    merchantId: "00000000-0000-0000-0000-000000000001",
  },
  {
    name: "Karim Agent Point (Demo Agent)",
    phone: "01700000004",
    email: "agent.karim@payora.local",
    password: "Password123!",
    pin: "5555",
    role: "USER",
    initialBalancePoisha: 5000000n, // ৳ 50,000.00
  },
  {
    name: "Admin Auditor (System Admin)",
    phone: "01700000000",
    email: "admin.demo@payora.local",
    password: "Password123!",
    pin: "0000",
    role: "ADMIN",
    initialBalancePoisha: 5000000n, // ৳ 50,000.00
  },
];

function generateMerchantQrPayload({ merchantId, accountId, name, secret }) {
  const qrSecret = secret || fileEnv.MERCHANT_QR_SECRET || "default-merchant-qr-secret-key-32";
  const payload = {
    type: "PAYORA_MERCHANT_QR",
    merchantId,
    accountId,
    name,
    amount: null,
    timestamp: Date.now(),
  };
  const signature = crypto
    .createHmac("sha256", qrSecret)
    .update(JSON.stringify(payload))
    .digest("hex");

  return Buffer.from(JSON.stringify({ ...payload, sig: signature })).toString("base64");
}

async function connectWithRetry(retries = 10, delayMs = 1500) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`[Seed] Waiting for database connection (attempt ${i}/${retries})...`);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function seed() {
  console.log("==> Seeding fake users, demo accounts, merchant, and system accounts...");
  let client;

  try {
    client = await connectWithRetry();
    await client.query("BEGIN");

    // 1. Seed System Accounts
    const systemAccounts = [
      { type: "SYSTEM_BANK_CLEARING", currency: "BDT" },
      { type: "SYSTEM_FEE_REVENUE", currency: "BDT" },
      { type: "SYSTEM_AGENT_CASH", currency: "BDT" },
    ];

    for (const sys of systemAccounts) {
      await client.query(
        `INSERT INTO accounts (type, currency, balance, status)
         SELECT $1, $2, 0, 'ACTIVE'
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE type = $1)`,
        [sys.type, sys.currency]
      );
    }

    const userMap = new Map();
    const accountMap = new Map();

    // 2. Seed Users & Wallets
    for (const u of FAKE_USERS) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const pinHash = await bcrypt.hash(u.pin, 10);

      const userRes = await client.query(
        `INSERT INTO users (name, phone, email, password_hash, pin_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (phone) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             pin_hash = EXCLUDED.pin_hash,
             role = EXCLUDED.role,
             status = 'ACTIVE',
             failed_pin_attempts = 0,
             pin_locked_until = NULL
         RETURNING id, role`,
        [u.name, u.phone, u.email, passwordHash, pinHash, u.role]
      );

      const userId = userRes.rows[0].id;
      userMap.set(u.phone, userId);
      const accountType = u.role === "MERCHANT" ? "MERCHANT_WALLET" : "USER_WALLET";

      // Ensure wallet account exists
      let accRes = await client.query(
        `SELECT id FROM accounts WHERE owner_id = $1 AND type = $2`,
        [userId, accountType]
      );

      let accountId;
      if (accRes.rows.length === 0) {
        accRes = await client.query(
          `INSERT INTO accounts (owner_id, type, currency, balance, status)
           VALUES ($1, $2, 'BDT', $3, 'ACTIVE')
           RETURNING id`,
          [userId, accountType, u.initialBalancePoisha.toString()]
        );
        accountId = accRes.rows[0].id;
      } else {
        accountId = accRes.rows[0].id;
        // Reset balance to demo amount on seed
        await client.query(
          `UPDATE accounts SET balance = $1, status = 'ACTIVE' WHERE id = $2`,
          [u.initialBalancePoisha.toString(), accountId]
        );
      }
      accountMap.set(u.phone, accountId);

      // Seed limits for users
      try {
        await client.query(
          `INSERT INTO limits (user_id, daily_send_limit, per_txn_limit, monthly_limit)
           VALUES ($1, 5000000, 2500000, 20000000)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
      } catch {
        // limits table might not exist yet if migrations didn't include it
      }

      // If Merchant, seed merchants table record
      if (u.role === "MERCHANT" && u.merchantId) {
        try {
          const qrCode = generateMerchantQrPayload({
            merchantId: u.merchantId,
            accountId,
            name: u.name,
          });

          await client.query(
            `INSERT INTO merchants (id, owner_id, name, account_id, qr_code, status)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
             ON CONFLICT (id) DO UPDATE
             SET account_id = EXCLUDED.account_id, qr_code = EXCLUDED.qr_code, status = 'ACTIVE'`,
            [u.merchantId, userId, u.name, accountId, qrCode]
          );
        } catch (mErr) {
          console.warn("Could not seed merchant record:", mErr.message);
        }
      }
    }

    // 3. Seed Saved Payee: Alice has Bob as a saved payee
    const aliceId = userMap.get("01700000001");
    const bobAccountId = accountMap.get("01700000002");
    if (aliceId && bobAccountId) {
      try {
        await client.query(
          `INSERT INTO payees (user_id, payee_account_id, nickname)
           SELECT $1, $2, 'Bob Hossain (Friend)'
           WHERE NOT EXISTS (
             SELECT 1 FROM payees WHERE user_id = $1 AND payee_account_id = $2
           )`,
          [aliceId, bobAccountId]
        );
      } catch {
        // ignore if payees table doesn't exist
      }
    }

    await client.query("COMMIT");
    console.log("==> Seeding completed successfully!");
    console.log("-----------------------------------------------------------------");
    console.log("Demo Credentials Available:");
    console.log("  • Alice Rahman (User):       Phone: 01700000001 | Pass: Password123! | PIN: 1234 (৳5,000)");
    console.log("  • Bob Hossain (User):        Phone: 01700000002 | Pass: Password123! | PIN: 4321 (৳2,000)");
    console.log("  • SuperMart Dhaka (Merchant):Phone: 01700000003 | Pass: Password123! | PIN: 9876 (৳10,000)");
    console.log("                               Merchant Code: 00000000-0000-0000-0000-000000000001");
    console.log("  • Karim Agent Point (Agent): Phone: 01700000004 | Pass: Password123! | PIN: 5555 (৳50,000)");
    console.log("  • Admin Auditor (Admin):     Phone: 01700000000 | Pass: Password123! | PIN: 0000 (৳50,000)");
    console.log("-----------------------------------------------------------------");
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
    }
    console.error("==> Seeding failed:", err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

seed();
