import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { generateWebhookSignature, verifyWebhookSignature } from "../../src/utils/signature.js";
import { createProviderApp } from "../../src/app.js";

describe("Mock Payment Provider", () => {
  const dummySecret = "test-secret-not-real-webhook-key-min-32-chars";

  describe("HMAC Webhook Signatures", () => {
    it("generates deterministic signature and verifies successfully", () => {
      const payload = { providerRef: "prov-123", amount: 50000n.toString() };
      const timestamp = Math.floor(Date.now() / 1000);

      const { signature } = generateWebhookSignature(payload, dummySecret, timestamp);
      expect(typeof signature).toBe("string");
      expect(signature).toHaveLength(64);

      const isValid = verifyWebhookSignature({
        payload,
        signature,
        timestamp,
        secret: dummySecret,
      });

      expect(isValid).toBe(true);
    });

    it("rejects signatures with tampered payloads", () => {
      const payload = { providerRef: "prov-123", amount: 50000 };
      const timestamp = Math.floor(Date.now() / 1000);

      const { signature } = generateWebhookSignature(payload, dummySecret, timestamp);

      const isTampered = verifyWebhookSignature({
        payload: { ...payload, amount: 99999 }, // Tampered
        signature,
        timestamp,
        secret: dummySecret,
      });

      expect(isTampered).toBe(false);
    });

    it("rejects webhook if timestamp has expired beyond tolerance window", () => {
      const payload = { providerRef: "prov-old" };
      // 10 minutes ago
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600;

      const { signature } = generateWebhookSignature(payload, dummySecret, expiredTimestamp);

      const isValid = verifyWebhookSignature({
        payload,
        signature,
        timestamp: expiredTimestamp,
        secret: dummySecret,
        toleranceSeconds: 300,
      });

      expect(isValid).toBe(false);
    });
  });

  describe("HTTP Initiate Endpoint", () => {
    const app = createProviderApp({
      NODE_ENV: "test",
      PORT: 3004,
      WEBHOOK_SECRET: dummySecret,
      LEDGER_SERVICE_URL: "http://localhost:3000",
    });

    it("POST /api/provider/initiate returns initiated status and signature", async () => {
      const res = await request(app)
        .post("/api/provider/initiate")
        .send({
          topUpId: "topup-1",
          amount: 50000,
          providerRef: "prov-ref-1",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("INITIATED");
      expect(res.body.data.simulatedWebhook.signature).toBeDefined();
    });
  });
});
