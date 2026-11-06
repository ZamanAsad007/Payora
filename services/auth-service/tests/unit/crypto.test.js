import { describe, it, expect } from "@jest/globals";
import {
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  generateRandomToken,
  hashToken,
} from "../../src/utils/crypto.js";
import { signAccessToken, verifyAccessToken } from "../../src/utils/jwt.js";

describe("Auth Service Crypto & JWT Utilities", () => {
  const dummyJwtSecret = "test-secret-not-real-jwt-auth-key-32chars";

  describe("Password Hashing", () => {
    it("hashes and verifies passwords correctly", async () => {
      const password = "SuperSecretPassword123!";
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(typeof hash).toBe("string");

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword("WrongPassword123!", hash);
      expect(isInvalid).toBe(false);
    });

    it("rejects passwords shorter than 8 characters", async () => {
      await expect(hashPassword("short")).rejects.toThrow("at least 8 characters");
    });
  });

  describe("PIN Hashing", () => {
    it("hashes and verifies 4-6 digit numeric PINs", async () => {
      const pin = "1234";
      const hash = await hashPin(pin);

      expect(hash).not.toBe(pin);
      expect(await verifyPin("1234", hash)).toBe(true);
      expect(await verifyPin("9999", hash)).toBe(false);
    });

    it("rejects non-numeric or invalid length PINs", async () => {
      await expect(hashPin("123")).rejects.toThrow("4 to 6 digits");
      await expect(hashPin("1234567")).rejects.toThrow("4 to 6 digits");
      await expect(hashPin("abcd")).rejects.toThrow("4 to 6 digits");
    });
  });

  describe("Token Generation & Hashing", () => {
    it("generates opaque random hex tokens", () => {
      const token1 = generateRandomToken(32);
      const token2 = generateRandomToken(32);
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it("hashes tokens deterministically with SHA-256", () => {
      const token = "sample-token-string";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe("JWT Operations", () => {
    it("signs and verifies access tokens", () => {
      const payload = { userId: "user-123", role: "USER" };
      const token = signAccessToken(payload, dummyJwtSecret, "15m");

      expect(typeof token).toBe("string");
      const decoded = verifyAccessToken(token, dummyJwtSecret);
      expect(decoded.userId).toBe("user-123");
      expect(decoded.role).toBe("USER");
    });

    it("throws when verifying with wrong secret", () => {
      const token = signAccessToken({ userId: "user-123" }, dummyJwtSecret);
      const wrongSecret = "test-secret-not-real-different-key-32chars";
      expect(() => verifyAccessToken(token, wrongSecret)).toThrow();
    });
  });
});
