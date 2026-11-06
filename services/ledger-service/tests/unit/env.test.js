import { describe, it, expect } from "@jest/globals";
import { validateEnv, envSchema } from "../../src/config/env.js";

describe("Environment Config Validation", () => {
  const validEnv = {
    NODE_ENV: "test",
    PORT: "3000",
    DATABASE_URL: "postgresql://postgres:password@localhost:5432/payora_ledger",
    REDIS_URL: "redis://localhost:6379",
    JWT_SECRET: "test-secret-not-real-jwt-key-32chars",
    WEBHOOK_SECRET: "test-secret-not-real-webhook-key-32c",
  };

  it("successfully parses valid environment variables", () => {
    const config = validateEnv(validEnv);
    expect(config.NODE_ENV).toBe("test");
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(config.REDIS_URL).toBe(validEnv.REDIS_URL);
    expect(config.JWT_SECRET).toBe(validEnv.JWT_SECRET);
    expect(config.WEBHOOK_SECRET).toBe(validEnv.WEBHOOK_SECRET);
  });

  it("throws fail-fast error when DATABASE_URL is missing or invalid", () => {
    const invalid = { ...validEnv, DATABASE_URL: "not-a-url" };
    expect(() => validateEnv(invalid)).toThrow("[Config Error] Environment validation failed");
  });

  it("throws fail-fast error when JWT_SECRET is shorter than 32 characters", () => {
    const invalid = { ...validEnv, JWT_SECRET: "too-short" };
    expect(() => validateEnv(invalid)).toThrow("JWT_SECRET must be at least 32 characters long");
  });

  it("throws fail-fast error when WEBHOOK_SECRET is missing", () => {
    const invalid = { ...validEnv };
    delete invalid.WEBHOOK_SECRET;
    expect(() => validateEnv(invalid)).toThrow("WEBHOOK_SECRET");
  });

  it("defaults NODE_ENV to development if omitted", () => {
    const withoutEnv = { ...validEnv };
    delete withoutEnv.NODE_ENV;
    const config = validateEnv(withoutEnv);
    expect(config.NODE_ENV).toBe("development");
  });
});
