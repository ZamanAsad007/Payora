import { query } from "../db/pool.js";
import {
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  generateRandomToken,
  hashToken,
} from "../utils/crypto.js";
import { signAccessToken } from "../utils/jwt.js";
import { getAuthEnv } from "../config/env.js";

export class AuthService {
  constructor(dbQuery = query) {
    this.query = dbQuery;
  }

  /**
   * Register a new user and wallet account.
   */
  async register({ name, phone, email, password }) {
    if (!name || !phone || !password) {
      const err = new Error("Name, phone number, and password are required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    // Phone format basic check
    if (!/^\+?[0-9]{10,15}$/.test(phone.replace(/\s+/g, ""))) {
      const err = new Error("Invalid phone number format");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    // Check if phone already registered
    const existing = await this.query("SELECT id FROM users WHERE phone = $1", [phone]);
    if (existing.rows.length > 0) {
      const err = new Error("Phone number already registered");
      err.code = "PHONE_ALREADY_EXISTS";
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await hashPassword(password);
    const insertRes = await this.query(
      `INSERT INTO users (name, phone, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, email, role, status, created_at`,
      [name, phone, email || null, passwordHash]
    );

    const user = insertRes.rows[0];

    // Auto-create USER_WALLET account in accounts table
    try {
      await this.query(
        `INSERT INTO accounts (owner_id, type, currency, balance, status)
         VALUES ($1, 'USER_WALLET', 'BDT', 0, 'ACTIVE')
         ON CONFLICT DO NOTHING`,
        [user.id]
      );
    } catch {
      // If accounts table is in a separate DB/service, handled via event or ledger endpoint
    }

    return user;
  }

  /**
   * Login user with phone, password, and optional device fingerprint.
   */
  async login({ phone, password, fingerprint = "default-device" }) {
    if (!phone || !password) {
      const err = new Error("Phone and password are required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const res = await this.query(
      `SELECT id, name, phone, email, role, status, password_hash, pin_hash
       FROM users WHERE phone = $1`,
      [phone]
    );

    if (res.rows.length === 0) {
      const err = new Error("Invalid phone or password");
      err.code = "INVALID_CREDENTIALS";
      err.statusCode = 401;
      throw err;
    }

    const user = res.rows[0];
    if (user.status !== "ACTIVE") {
      const err = new Error("Account is suspended or closed");
      err.code = "ACCOUNT_SUSPENDED";
      err.statusCode = 403;
      throw err;
    }

    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      const err = new Error("Invalid phone or password");
      err.code = "INVALID_CREDENTIALS";
      err.statusCode = 401;
      throw err;
    }

    // Track device fingerprint
    let deviceTrusted = false;
    if (fingerprint) {
      const devRes = await this.query(
        `INSERT INTO devices (user_id, fingerprint, last_seen_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, fingerprint)
         DO UPDATE SET last_seen_at = NOW()
         RETURNING trusted`,
        [user.id, fingerprint]
      );
      deviceTrusted = devRes.rows[0]?.trusted || false;
    }

    // Generate JWT access token & refresh token
    const env = getAuthEnv();
    const accessToken = signAccessToken(
      { userId: user.id, phone: user.phone, role: user.role },
      env.JWT_SECRET,
      env.JWT_ACCESS_EXPIRY
    );

    const rawRefreshToken = generateRandomToken(40);
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await this.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        hasPin: Boolean(user.pin_hash),
      },
      device: {
        fingerprint,
        trusted: deviceTrusted,
      },
    };
  }

  /**
   * Rotate refresh token and issue fresh access token.
   */
  async refresh({ refreshToken }) {
    if (!refreshToken) {
      const err = new Error("Refresh token is required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const hashed = hashToken(refreshToken);
    const res = await this.query(
      `SELECT r.id, r.user_id, r.expires_at, r.revoked_at, u.phone, u.role, u.status
       FROM refresh_tokens r
       JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = $1`,
      [hashed]
    );

    if (res.rows.length === 0) {
      const err = new Error("Invalid refresh token");
      err.code = "INVALID_TOKEN";
      err.statusCode = 401;
      throw err;
    }

    const tokenRecord = res.rows[0];
    if (tokenRecord.revoked_at || new Date(tokenRecord.expires_at) < new Date()) {
      const err = new Error("Refresh token expired or revoked");
      err.code = "TOKEN_EXPIRED";
      err.statusCode = 401;
      throw err;
    }

    if (tokenRecord.status !== "ACTIVE") {
      const err = new Error("User account is inactive");
      err.code = "ACCOUNT_INACTIVE";
      err.statusCode = 403;
      throw err;
    }

    // Revoke old token (rotation)
    await this.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [tokenRecord.id]);

    // Issue new tokens
    const env = getAuthEnv();
    const newAccessToken = signAccessToken(
      { userId: tokenRecord.user_id, phone: tokenRecord.phone, role: tokenRecord.role },
      env.JWT_SECRET,
      env.JWT_ACCESS_EXPIRY
    );

    const newRawRefreshToken = generateRandomToken(40);
    const newTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await this.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenRecord.user_id, newTokenHash, expiresAt]
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  /**
   * Revoke refresh token on logout.
   */
  async logout({ refreshToken }) {
    if (!refreshToken) return { success: true };
    const hashed = hashToken(refreshToken);
    await this.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1", [hashed]);
    return { success: true };
  }

  /**
   * Set or change transaction PIN (4-6 digits).
   */
  async setPin({ userId, pin, oldPin = null }) {
    if (!userId || !pin) {
      const err = new Error("User ID and PIN are required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const userRes = await this.query("SELECT pin_hash FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      const err = new Error("User not found");
      err.code = "NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    const currentPinHash = userRes.rows[0].pin_hash;
    // If PIN was already set, old PIN must be verified
    if (currentPinHash && oldPin) {
      const isOldPinValid = await verifyPin(oldPin, currentPinHash);
      if (!isOldPinValid) {
        const err = new Error("Current transaction PIN is incorrect");
        err.code = "INVALID_PIN";
        err.statusCode = 401;
        throw err;
      }
    }

    const newPinHash = await hashPin(pin);
    await this.query(
      `UPDATE users
       SET pin_hash = $1, failed_pin_attempts = 0, pin_locked_until = NULL, updated_at = NOW()
       WHERE id = $2`,
      [newPinHash, userId]
    );

    return { success: true, message: "Transaction PIN set successfully" };
  }

  /**
   * Verify transaction PIN with 3-attempt brute-force protection and 30-minute lockout.
   */
  async verifyPin({ userId, pin }) {
    if (!userId || !pin) {
      const err = new Error("User ID and PIN are required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const userRes = await this.query(
      `SELECT pin_hash, failed_pin_attempts, pin_locked_until
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      const err = new Error("User not found");
      err.code = "NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    const user = userRes.rows[0];

    // Check if user has a PIN configured
    if (!user.pin_hash) {
      const err = new Error("Transaction PIN has not been set");
      err.code = "PIN_NOT_SET";
      err.statusCode = 400;
      throw err;
    }

    // Check if PIN is currently locked
    if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(user.pin_locked_until).getTime() - Date.now()) / (60 * 1000)
      );
      const err = new Error(`Transaction PIN is locked. Try again in ${remainingMinutes} minute(s).`);
      err.code = "PIN_LOCKED";
      err.statusCode = 403;
      err.details = { lockedUntil: user.pin_locked_until, remainingMinutes };
      throw err;
    }

    const isValid = await verifyPin(pin, user.pin_hash);

    if (!isValid) {
      const attempts = user.failed_pin_attempts + 1;
      const MAX_ATTEMPTS = 3;

      if (attempts >= MAX_ATTEMPTS) {
        // Lock for 30 minutes
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        await this.query(
          `UPDATE users
           SET failed_pin_attempts = $1, pin_locked_until = $2
           WHERE id = $3`,
          [attempts, lockUntil, userId]
        );

        const err = new Error("Too many failed attempts. Transaction PIN locked for 30 minutes.");
        err.code = "PIN_LOCKED";
        err.statusCode = 403;
        err.details = { lockedUntil: lockUntil, remainingMinutes: 30 };
        throw err;
      } else {
        await this.query(
          `UPDATE users SET failed_pin_attempts = $1 WHERE id = $2`,
          [attempts, userId]
        );

        const remaining = MAX_ATTEMPTS - attempts;
        const err = new Error(`Invalid PIN. ${remaining} attempt(s) remaining.`);
        err.code = "INVALID_PIN";
        err.statusCode = 401;
        err.details = { attemptsRemaining: remaining };
        throw err;
      }
    }

    // Success: reset failed attempts
    if (user.failed_pin_attempts > 0 || user.pin_locked_until) {
      await this.query(
        `UPDATE users SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = $1`,
        [userId]
      );
    }

    return { valid: true };
  }
}
