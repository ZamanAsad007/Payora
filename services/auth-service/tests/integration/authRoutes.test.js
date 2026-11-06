import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createAuthApp } from "../../src/app.js";
import { AuthService } from "../../src/services/authService.js";

function createMockDb() {
  const users = new Map();
  const devices = new Map();
  const refreshTokens = new Map();

  return async function mockQuery(sql, params = []) {
    const s = sql.trim();

    if (s.startsWith("SELECT") && s.includes("FROM users WHERE phone = $1")) {
      const user = Array.from(users.values()).find((u) => u.phone === params[0]);
      return { rows: user ? [user] : [] };
    }

    if (s.startsWith("SELECT") && s.includes("FROM users WHERE id = $1")) {
      const user = users.get(params[0]);
      return { rows: user ? [user] : [] };
    }

    if (s.startsWith("INSERT INTO users")) {
      const id = "mock-uuid-123";
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
      };
      users.set(id, newUser);
      return { rows: [newUser] };
    }

    if (s.startsWith("INSERT INTO devices")) {
      return { rows: [{ trusted: true }] };
    }

    if (s.startsWith("INSERT INTO refresh_tokens")) {
      return { rows: [{ id: "tok-1" }] };
    }

    if (s.startsWith("UPDATE users") && s.includes("SET pin_hash = $1")) {
      const user = users.get(params[1]);
      if (user) user.pin_hash = params[0];
      return { rowCount: 1 };
    }

    if (s.startsWith("UPDATE users SET failed_pin_attempts = 0")) {
      return { rowCount: 1 };
    }

    return { rows: [] };
  };
}

describe("Auth Routes HTTP Integration Tests", () => {
  let app;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-not-real-jwt-auth-key-32chars";
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/payora_auth";
    const authService = new AuthService(createMockDb());
    app = createAuthApp(authService);
  });

  it("POST /api/auth/register creates user account", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Rahim Chowdhury",
        phone: "01722223333",
        email: "rahim@example.com",
        password: "SecretPassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.phone).toBe("01722223333");
  });

  it("POST /api/auth/login logs in and issues JWT", async () => {
    // Register
    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Karim",
        phone: "01733334444",
        password: "SecretPassword123!",
      });

    // Login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        phone: "01733334444",
        password: "SecretPassword123!",
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.refreshToken).toBeDefined();
  });

  it("POST /api/auth/pin sets PIN and POST /api/auth/pin/verify validates it", async () => {
    // Register & login
    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Farhan",
        phone: "01744445555",
        password: "SecretPassword123!",
      });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        phone: "01744445555",
        password: "SecretPassword123!",
      });

    const token = loginRes.body.data.accessToken;

    // Set PIN
    const setPinRes = await request(app)
      .post("/api/auth/pin")
      .set("Authorization", `Bearer ${token}`)
      .send({ pin: "4321" });

    expect(setPinRes.status).toBe(200);
    expect(setPinRes.body.success).toBe(true);

    // Verify PIN
    const verifyPinRes = await request(app)
      .post("/api/auth/pin/verify")
      .set("Authorization", `Bearer ${token}`)
      .send({ pin: "4321" });

    expect(verifyPinRes.status).toBe(200);
    expect(verifyPinRes.body.data.valid).toBe(true);
  });
});
