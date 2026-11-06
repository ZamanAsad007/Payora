#!/usr/bin/env node

/**
 * generate-secrets.js
 *
 * Generates cryptographically secure random secrets and writes them
 * exclusively to the gitignored `.env` file.
 *
 * SAFETY RULE: Never print secret values to stdout, stderr, or log files.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

function generateSecureRandomHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function main() {
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  } else if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, "utf-8");
  } else {
    console.error("Neither .env nor .env.example found.");
    process.exit(1);
  }

  const jwtSecret = generateSecureRandomHex(32);
  const webhookSecret = generateSecureRandomHex(32);
  const dbPassword = generateSecureRandomHex(16);

  // Replace placeholders
  envContent = envContent.replace(
    /JWT_SECRET=.*/g,
    `JWT_SECRET=${jwtSecret}`
  );
  envContent = envContent.replace(
    /WEBHOOK_SECRET=.*/g,
    `WEBHOOK_SECRET=${webhookSecret}`
  );
  envContent = envContent.replace(
    /POSTGRES_PASSWORD=.*/g,
    `POSTGRES_PASSWORD=${dbPassword}`
  );
  envContent = envContent.replace(
    /postgres:replace-me-postgres-password@/g,
    `postgres:${dbPassword}@`
  );

  fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  console.log("Successfully generated secrets and updated .env (0600 permissions).");
  console.log("No secrets were displayed to terminal output.");
}

main();
