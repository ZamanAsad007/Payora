import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("Health Check API", () => {
  const app = createApp();

  it("GET /health returns 200 with service info", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("ledger-service");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /api/health returns 200 with standard response envelope", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.service).toBe("ledger-service");
    expect(res.body.error).toBeNull();
  });
});
