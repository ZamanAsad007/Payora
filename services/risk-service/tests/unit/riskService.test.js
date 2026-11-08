import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { RuleEngine } from "../../src/engine/ruleEngine.js";
import { RiskService } from "../../src/services/riskService.js";
import { createApp } from "../../src/app.js";

function createMockDb() {
  const flags = new Map();

  const mockPool = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      // Insert flag
      if (s.startsWith("INSERT INTO risk_flags")) {
        const flag = {
          id: params[0],
          entry_id: params[1],
          user_id: params[2],
          rule_code: params[3],
          severity: params[4],
          status: "OPEN",
          metadata: typeof params[5] === "string" ? JSON.parse(params[5]) : params[5],
          created_at: new Date(),
        };
        flags.set(flag.id, flag);
        return { rows: [flag] };
      }

      // Select flags list
      if (s.startsWith("SELECT * FROM risk_flags WHERE 1=1")) {
        return { rows: Array.from(flags.values()) };
      }

      // Select flag by ID
      if (s.startsWith("SELECT * FROM risk_flags WHERE id = $1")) {
        const flag = flags.get(params[0]);
        return { rows: flag ? [flag] : [] };
      }

      // Update flag status
      if (s.startsWith("UPDATE risk_flags")) {
        const flag = flags.get(params[2]);
        if (flag) {
          flag.status = params[0];
          flag.updated_at = new Date();
          return { rows: [flag] };
        }
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  return { mockPool, flags };
}

describe("Risk Service & Rule Engine", () => {
  let ruleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  describe("RuleEngine rules", () => {
    it("flags VELOCITY_SPIKE when more than 5 transfers occur within 2 minutes", () => {
      const userId = "user-velocity-1";
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        const res = ruleEngine.evaluate({
          userId,
          amount: 1000n,
          timestamp: now + i * 1000,
        });
        expect(res.find((v) => v.ruleCode === "VELOCITY_SPIKE")).toBeUndefined();
      }

      // 6th transfer within the 2 minute window
      const sixth = ruleEngine.evaluate({
        userId,
        amount: 1000n,
        timestamp: now + 6000,
      });

      const spike = sixth.find((v) => v.ruleCode === "VELOCITY_SPIKE");
      expect(spike).toBeDefined();
      expect(spike.severity).toBe("HIGH");
      expect(spike.metadata.transfersInWindow).toBe(6);
    });

    it("flags LARGE_AMOUNT when transfer is >= 20,000 BDT (2,000,000 poisha)", () => {
      const res = ruleEngine.evaluate({
        userId: "user-large",
        amount: 2500000n, // 25,000 BDT
      });

      const large = res.find((v) => v.ruleCode === "LARGE_AMOUNT");
      expect(large).toBeDefined();
      expect(large.severity).toBe("MEDIUM");
    });

    it("flags NEW_PAYEE when transferring >= 5,000 BDT to a new payee", () => {
      const res = ruleEngine.evaluate({
        userId: "user-new-payee",
        payeeId: "payee-first-time",
        amount: 600000n, // 6,000 BDT
        isNewPayee: true,
      });

      const newPayeeFlag = res.find((v) => v.ruleCode === "NEW_PAYEE");
      expect(newPayeeFlag).toBeDefined();
      expect(newPayeeFlag.severity).toBe("MEDIUM");

      // Next transfer to the same payee is not flagged as new payee
      const repeat = ruleEngine.evaluate({
        userId: "user-new-payee",
        payeeId: "payee-first-time",
        amount: 600000n,
      });
      expect(repeat.find((v) => v.ruleCode === "NEW_PAYEE")).toBeUndefined();
    });

    it("flags NEW_DEVICE when device is untrusted", () => {
      const res = ruleEngine.evaluate({
        userId: "user-device",
        amount: 1000n,
        trustedDevice: false,
        deviceId: "device-unrecognized",
      });

      const devFlag = res.find((v) => v.ruleCode === "NEW_DEVICE");
      expect(devFlag).toBeDefined();
      expect(devFlag.severity).toBe("LOW");
    });
  });

  describe("RiskService processing & automatic temporary holds", () => {
    it("automatically triggers hold action on HIGH severity velocity violation", async () => {
      const holds = [];
      const { mockPool } = createMockDb();

      const riskService = new RiskService({
        pool: mockPool,
        ruleEngine,
        onAutoHold: async (data) => {
          holds.push(data);
        },
      });

      const userId = "user-hold-test";
      const now = Date.now();

      // Trigger 6 rapid transfers
      for (let i = 0; i < 5; i++) {
        await riskService.processEvent({ userId, amount: 5000n, timestamp: now + i * 100 });
      }

      const res = await riskService.processEvent({ userId, amount: 5000n, timestamp: now + 600 });
      expect(res.autoHoldTriggered).toBe(true);
      expect(holds.length).toBe(1);
      expect(holds[0].userId).toBe(userId);
      expect(holds[0].ruleCode).toBe("VELOCITY_SPIKE");
    });

    it("allows admin to review and clear a flag, invoking unfreeze callback", async () => {
      const { mockPool, flags } = createMockDb();
      const unfreezes = [];

      const riskService = new RiskService({ pool: mockPool, ruleEngine });

      // Create a flag
      const flagId = "flag-123";
      flags.set(flagId, {
        id: flagId,
        user_id: "user-1",
        rule_code: "VELOCITY_SPIKE",
        severity: "HIGH",
        status: "OPEN",
      });

      const reviewed = await riskService.reviewFlag({
        flagId,
        newStatus: "CLEARED",
        reviewerNotes: "Customer verified transaction over phone call",
        onClearUnfreeze: async (data) => {
          unfreezes.push(data);
        },
      });

      expect(reviewed.status).toBe("CLEARED");
      expect(unfreezes.length).toBe(1);
      expect(unfreezes[0].userId).toBe("user-1");
    });
  });

  describe("HTTP Routes (Supertest)", () => {
    it("processes /api/risk/evaluate and reviews /api/risk/flags/:id/review", async () => {
      const { mockPool, flags } = createMockDb();
      const riskService = new RiskService({ pool: mockPool });
      const app = createApp({ riskService });

      // 1. Health check
      const healthRes = await request(app).get("/health");
      expect(healthRes.status).toBe(200);

      // 2. Evaluate event
      const evalRes = await request(app)
        .post("/api/risk/evaluate")
        .send({
          userId: "user-http-1",
          amount: 2500000,
        });

      expect(evalRes.status).toBe(200);
      expect(evalRes.body.success).toBe(true);
      expect(evalRes.body.data.flagsCreated.length).toBe(1);
      expect(evalRes.body.data.flagsCreated[0].ruleCode).toBe("LARGE_AMOUNT");

      // 3. List flags
      const listRes = await request(app).get("/api/risk/flags");
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);

      // 4. Review flag
      const flagId = evalRes.body.data.flagsCreated[0].id;
      const reviewRes = await request(app)
        .post(`/api/risk/flags/${flagId}/review`)
        .send({
          status: "CLEARED",
          notes: "Approved high-value payment",
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe("CLEARED");
    });
  });
});
