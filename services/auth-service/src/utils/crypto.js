import crypto from "node:crypto";
import bcrypt from "bcrypt";

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash a user account password securely using bcrypt.
 */
export async function hashPassword(password) {
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Hash a 4-6 digit numeric transaction PIN.
 */
export async function hashPin(pin) {
  if (!pin || !/^\d{4,6}$/.test(String(pin))) {
    throw new Error("Transaction PIN must be 4 to 6 digits");
  }
  return bcrypt.hash(String(pin), BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a transaction PIN against stored hash.
 */
export async function verifyPin(pin, hash) {
  if (!pin || !hash) return false;
  return bcrypt.compare(String(pin), hash);
}

/**
 * Generate a cryptographically secure random opaque token (e.g., refresh token).
 */
export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generate a SHA-256 hash of a token for safe database storage.
 */
export function hashToken(token) {
  if (!token) throw new Error("Token cannot be empty");
  return crypto.createHash("sha256").update(token).digest("hex");
}
