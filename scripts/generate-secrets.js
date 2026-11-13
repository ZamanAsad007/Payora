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

function setOrAppendKey(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  return `${content.trimEnd()}\n${key}=${value}\n`;
}

function shouldReplace(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return true;
  const val = match[1].trim();
  return !val || val.includes("replace-me");
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

  const isForce = process.argv.includes("--force");

  // Generate new secrets or preserve existing valid ones
  let jwtSecret = generateSecureRandomHex(32);
  let webhookSecret = generateSecureRandomHex(32);
  let merchantQrSecret = generateSecureRandomHex(32);
  let dbPassword = generateSecureRandomHex(16);

  if (!isForce && !shouldReplace(envContent, "POSTGRES_PASSWORD")) {
    const m = envContent.match(/^POSTGRES_PASSWORD=(.*)$/m);
    dbPassword = m[1].trim();
  }
  if (!isForce && !shouldReplace(envContent, "JWT_SECRET")) {
    const m = envContent.match(/^JWT_SECRET=(.*)$/m);
    jwtSecret = m[1].trim();
  }
  if (!isForce && !shouldReplace(envContent, "WEBHOOK_SECRET")) {
    const m = envContent.match(/^WEBHOOK_SECRET=(.*)$/m);
    webhookSecret = m[1].trim();
  }
  if (!isForce && !shouldReplace(envContent, "MERCHANT_QR_SECRET")) {
    const m = envContent.match(/^MERCHANT_QR_SECRET=(.*)$/m);
    merchantQrSecret = m[1].trim();
  }

  // Set or replace keys
  envContent = setOrAppendKey(envContent, "JWT_SECRET", jwtSecret);
  envContent = setOrAppendKey(envContent, "WEBHOOK_SECRET", webhookSecret);
  envContent = setOrAppendKey(envContent, "MERCHANT_QR_SECRET", merchantQrSecret);
  envContent = setOrAppendKey(envContent, "POSTGRES_PASSWORD", dbPassword);
  envContent = setOrAppendKey(envContent, "POSTGRES_PORT", "5433");
  envContent = setOrAppendKey(envContent, "REDIS_PORT", "6380");

  envContent = envContent.replace(
    /postgres:[^@]+@/g,
    `postgres:${dbPassword}@`
  );

  fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  console.log("Successfully validated/updated secrets in .env (0600 permissions).");
  console.log("No secrets were displayed to terminal output.");
}

main();
