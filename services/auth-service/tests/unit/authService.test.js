import { describe, it, expect, beforeEach } from "@jest/globals";
import { AuthService } from "../../src/services/authService.js";
import { hashPassword, hashPin } from "../../src/utils/crypto.js";

// Setup mock database for fast and isolated unit testing
function createMockDb() {
  const users = new Map();
  const devices = new Map();
  const refreshTokens = new Map();
  const accounts = new Map();

  return async function mockQuery(sql, params = []) {
    const s = sql.trim();

    // 1. SELECT users by phone
    if (s.startsWith("SELECT") && s.includes("FROM users WHERE phone = $1")) {
      const user = Array.from(users.values()).find((u) => u.phone === params[0]);
      return { rows: user ? [user] : [] };
    }

    // 2. SELECT users by id
    if (s.startsWith("SELECT") && s.includes("FROM users WHERE id = $1")) {
      const user = users.get(params[0]);
      return { rows: user ? [user] : [] };
    }

    // 3. INSERT user
    if (s.startsWith("INSERT INTO users")) {
      const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newUser = {
        id,
        name: params[0],
        phone: params[1],
        email: params[2],
        password_hash: params[3],
        pin_hash: null,
        role: "USER",
        status: "ACTIVE",
        failed_pin_attempts: 0,
        pin_locked_until: null,
        created_at: new Date(),
      };
      users.set(id, newUser);
      return { rows: [newUser] };
    }

    // 4. INSERT / UPDATE device
    if (s.startsWith("INSERT INTO devices")) {
      const key = `${params[0]}-${params[1]}`;
      const dev = { userId: params[0], fingerprint: params[1], trusted: false, last_seen_at: new Date() };
      devices.set(key, dev);
      return { rows: [{ trusted: false }] };
    }

    // 5. INSERT refresh_tokens
    if (s.startsWith("INSERT INTO refresh_tokens")) {
      const id = `tok-${Date.now()}-${Math.random()}`;
      const token = {
        id,
        user_id: params[0],
        token_hash: params[1],
        expires_at: params[2],
        revoked_at: null,
      };
      refreshTokens.set(params[1], token);
      return { rows: [token] };
    }

    // 6. SELECT refresh token with user join
    if (s.startsWith("SELECT") && s.includes("FROM refresh_tokens r") && s.includes("WHERE r.token_hash = $1")) {
      const tok = refreshTokens.get(params[0]);
      if (!tok) return { rows: [] };
      const user = users.get(tok.user_id);
      return {
        rows: [
          {
            id: tok.id,
            user_id: tok.user_id,
            expires_at: tok.expires_at,
            revoked_at: tok.revoked_at,
            phone: user?.phone,
            role: user?.role,
            status: user?.status,
          },
        ],
      };
    }

    // 7. UPDATE refresh_tokens (revoke)
    if (s.startsWith("UPDATE refresh_tokens SET revoked_at = NOW()")) {
      for (const tok of refreshTokens.values()) {
        if (tok.id === params[0] || tok.token_hash === params[0]) {
          tok.revoked_at = new Date();
        }
      }
      return { rowCount: 1 };
    }

    // 8. UPDATE users PIN
    if (s.startsWith("UPDATE users") && s.includes("SET pin_hash = $1")) {
      const user = users.get(params[1]);
      if (user) {
        user.pin_hash = params[0];
        user.failed_pin_attempts = 0;
        user.pin_locked_until = null;
      }
      return { rowCount: 1 };
    }

    // 9. UPDATE users failed attempts
    if (s.startsWith("UPDATE users") && s.includes("failed_pin_attempts = $1, pin_locked_until = $2")) {
      const user = users.get(params[2]);
      if (user) {
        user.failed_pin_attempts = params[0];
        user.pin_locked_until = params[1];
      }
      return { rowCount: 1 };
    }

    if (s.startsWith("UPDATE users SET failed_pin_attempts = $1 WHERE id = $2")) {
      const user = users.get(params[1]);
      if (user) {
        user.failed_pin_attempts = params[0];
      }
      return { rowCount: 1 };
    }

    if (s.startsWith("UPDATE users SET failed_pin_attempts = 0")) {
      const user = users.get(params[0]);
      if (user) {
        user.failed_pin_attempts = 0;
        user.pin_locked_until = null;
      }
      return { rowCount: 1 };
    }

    // Fallback for auto-created accounts
    if (s.includes("INSERT INTO accounts")) {
      accounts.set(params[0], { ownerId: params[0], balance: 0n });
      return { rows: [] };
    }

    return { rows: [] };
  };
}

describe("AuthService Unit Tests", () => {
  let authService;
  let mockDb;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-not-real-jwt-auth-key-32chars";
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/payora_auth";
    mockDb = createMockDb();
    authService = new AuthService(mockDb);
  });

  describe("Registration", () => {
    it("successfully registers a new user", async () => {
      const user = await authService.register({
        name: "Test User",
        phone: "01711112222",
        email: "test@example.com",
        password: "Password123!",
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.name).toBe("Test User");
      expect(user.phone).toBe("01711112222");
    });

    it("rejects registration with duplicate phone", async () => {
      await authService.register({
        name: "User One",
        phone: "01711113333",
        password: "Password123!",
      });

      await expect(
        authService.register({
          name: "User Two",
          phone: "01711113333",
          password: "Password123!",
        })
      ).rejects.toThrow("Phone number already registered");
    });
  });

  describe("Login & Refresh Tokens", () => {
    it("logs in with valid credentials and issues access & refresh tokens", async () => {
      await authService.register({
        name: "Alice",
        phone: "01711114444",
        password: "Password123!",
      });

      const res = await authService.login({
        phone: "01711114444",
        password: "Password123!",
        fingerprint: "chrome-fingerprint-123",
      });

      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
      expect(res.user.phone).toBe("01711114444");
      expect(res.device.fingerprint).toBe("chrome-fingerprint-123");
    });

    it("rejects login with wrong password", async () => {
      await authService.register({
        name: "Bob",
        phone: "01711115555",
        password: "CorrectPassword123!",
      });

      await expect(
        authService.login({
          phone: "01711115555",
          password: "WrongPassword123!",
        })
      ).rejects.toThrow("Invalid phone or password");
    });

    it("rotates refresh token and issues new access token", async () => {
      await authService.register({
        name: "Charlie",
        phone: "01711116666",
        password: "Password123!",
      });

      const loginRes = await authService.login({
        phone: "01711116666",
        password: "Password123!",
      });

      const refreshRes = await authService.refresh({
        refreshToken: loginRes.refreshToken,
      });

      expect(refreshRes.accessToken).toBeDefined();
      expect(refreshRes.refreshToken).toBeDefined();
      expect(refreshRes.refreshToken).not.toBe(loginRes.refreshToken);
    });
  });

  describe("Transaction PIN & Lockout", () => {
    let testUserId;

    beforeEach(async () => {
      const user = await authService.register({
        name: "Pin User",
        phone: "01711117777",
        password: "Password123!",
      });
      testUserId = user.id;
    });

    it("sets and verifies transaction PIN", async () => {
      await authService.setPin({ userId: testUserId, pin: "5678" });
      const verifyRes = await authService.verifyPin({ userId: testUserId, pin: "5678" });
      expect(verifyRes.valid).toBe(true);
    });

    it("tracks failed attempts and locks after 3 incorrect attempts", async () => {
      await authService.setPin({ userId: testUserId, pin: "1234" });

      // Attempt 1
      await expect(authService.verifyPin({ userId: testUserId, pin: "0000" })).rejects.toMatchObject({
        code: "INVALID_PIN",
        details: { attemptsRemaining: 2 },
      });

      // Attempt 2
      await expect(authService.verifyPin({ userId: testUserId, pin: "0000" })).rejects.toMatchObject({
        code: "INVALID_PIN",
        details: { attemptsRemaining: 1 },
      });

      // Attempt 3 -> triggers 30-minute lockout
      await expect(authService.verifyPin({ userId: testUserId, pin: "0000" })).rejects.toMatchObject({
        code: "PIN_LOCKED",
      });

      // Attempt 4 while locked
      await expect(authService.verifyPin({ userId: testUserId, pin: "1234" })).rejects.toMatchObject({
        code: "PIN_LOCKED",
      });
    });

    it("resets failed attempt counter after correct PIN", async () => {
      await authService.setPin({ userId: testUserId, pin: "1234" });

      // 1 wrong attempt
      await expect(authService.verifyPin({ userId: testUserId, pin: "9999" })).rejects.toMatchObject({
        code: "INVALID_PIN",
      });

      // Correct attempt
      const correctRes = await authService.verifyPin({ userId: testUserId, pin: "1234" });
      expect(correctRes.valid).toBe(true);

      // Next wrong attempt should have 2 attempts remaining again
      await expect(authService.verifyPin({ userId: testUserId, pin: "9999" })).rejects.toMatchObject({
        details: { attemptsRemaining: 2 },
      });
    });

    it("requires old PIN when updating an existing PIN", async () => {
      await authService.setPin({ userId: testUserId, pin: "1234" });

      // Attempt to change without oldPin
      await expect(authService.setPin({ userId: testUserId, pin: "5678" })).rejects.toMatchObject({
        code: "OLD_PIN_REQUIRED",
      });

      // Attempt to change with wrong oldPin
      await expect(authService.setPin({ userId: testUserId, pin: "5678", oldPin: "0000" })).rejects.toMatchObject({
        code: "INVALID_PIN",
      });

      // Change with correct oldPin succeeds
      const res = await authService.setPin({ userId: testUserId, pin: "5678", oldPin: "1234" });
      expect(res.success).toBe(true);

      // Verify new pin works
      const verifyNew = await authService.verifyPin({ userId: testUserId, pin: "5678" });
      expect(verifyNew.valid).toBe(true);
    });
  });
});
