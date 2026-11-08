import { describe, it, expect, beforeEach } from "@jest/globals";
import { OutboxService } from "../../src/services/outboxService.js";
import { AdminService } from "../../src/services/adminService.js";
import { LimitChecker } from "../../src/domain/limitChecker.js";

function createMockDb() {
  const accounts = new Map([
    ["acc-user1", { id: "acc-user1", owner_id: "user-1", type: "USER_WALLET", status: "ACTIVE" }],
    ["acc-user2", { id: "acc-user2", owner_id: "user-2", type: "USER_WALLET", status: "ACTIVE" }],
  ]);
  const limits = new Map();
  const outbox = [];

  const mockClient = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      // Outbox insert
      if (s.startsWith("INSERT INTO outbox")) {
        const row = {
          id: outbox.length + 1,
          topic: params[0],
          payload: typeof params[1] === "string" ? JSON.parse(params[1]) : params[1],
          created_at: new Date(),
          published_at: null,
        };
        outbox.push(row);
        return { rows: [row] };
      }

      // Outbox select unpublished
      if (s.startsWith("SELECT") && s.includes("FROM outbox") && s.includes("published_at IS NULL")) {
        const unpublished = outbox.filter((e) => e.published_at === null);
        return { rows: unpublished };
      }

      // Outbox update published_at
      if (s.startsWith("UPDATE outbox") && s.includes("SET published_at = NOW()")) {
        const ids = params[0];
        for (const item of outbox) {
          if (ids.includes(item.id)) {
            item.published_at = new Date();
          }
        }
        return { rowCount: ids.length };
      }

      // Freeze account
      if (s.startsWith("UPDATE accounts") && s.includes("SET status = 'FROZEN'")) {
        const acc = accounts.get(params[0]);
        if (acc) {
          acc.status = "FROZEN";
          return { rows: [acc] };
        }
        return { rows: [] };
      }

      // Unfreeze account
      if (s.startsWith("UPDATE accounts") && s.includes("SET status = 'ACTIVE'")) {
        const acc = accounts.get(params[0]);
        if (acc) {
          acc.status = "ACTIVE";
          return { rows: [acc] };
        }
        return { rows: [] };
      }

      // Limits insert / upsert
      if (s.startsWith("INSERT INTO limits")) {
        const rec = {
          user_id: params[0],
          daily_send_limit: params[1],
          per_txn_limit: params[2],
          monthly_limit: params[3],
        };
        limits.set(rec.user_id, rec);
        return { rows: [rec] };
      }

      // Limits select
      if (s.startsWith("SELECT") && s.includes("FROM limits WHERE user_id = $1")) {
        const rec = limits.get(params[0]);
        return { rows: rec ? [rec] : [] };
      }

      return { rows: [] };
    },
    release: () => {},
  };

  const pool = {
    connect: async () => mockClient,
    query: async (sql, params) => mockClient.query(sql, params),
  };

  return { pool, mockClient, accounts, limits, outbox };
}

describe("Transactional Outbox and Limits", () => {
  let mockDb;
  let outboxService;
  let adminService;

  beforeEach(() => {
    mockDb = createMockDb();
    outboxService = new OutboxService(mockDb.pool);
    adminService = new AdminService(mockDb.pool);
  });

  describe("OutboxService", () => {
    it("records events inside active db transaction client", async () => {
      const client = await mockDb.pool.connect();
      const recorded = await OutboxService.recordEvent(client, {
        topic: "transfers.p2p",
        payload: {
          type: "P2P_TRANSFER",
          senderUserId: "user-1",
          amount: "50000",
        },
      });

      expect(recorded.id).toBeDefined();
      expect(recorded.topic).toBe("transfers.p2p");
      expect(recorded.payload.eventId).toBeDefined();
      expect(mockDb.outbox.length).toBe(1);
    });

    it("publishes batches of pending outbox events and updates published_at", async () => {
      const client = await mockDb.pool.connect();
      await OutboxService.recordEvent(client, { topic: "test.topic.1", payload: { n: 1 } });
      await OutboxService.recordEvent(client, { topic: "test.topic.2", payload: { n: 2 } });

      const published = [];
      const res = await outboxService.publishBatch({
        batchSize: 10,
        publishFn: async (event) => {
          published.push(event.topic);
        },
      });

      expect(res.publishedCount).toBe(2);
      expect(published).toEqual(["test.topic.1", "test.topic.2"]);
      expect(mockDb.outbox[0].published_at).not.toBeNull();
      expect(mockDb.outbox[1].published_at).not.toBeNull();
    });
  });

  describe("AdminService", () => {
    it("freezes and unfreezes accounts with audit reasons", async () => {
      const frozen = await adminService.freezeAccount({
        accountId: "acc-user1",
        reason: "Suspicious velocity flag",
      });
      expect(frozen.status).toBe("FROZEN");
      expect(mockDb.accounts.get("acc-user1").status).toBe("FROZEN");

      const unfrozen = await adminService.unfreezeAccount({
        accountId: "acc-user1",
        reason: "Admin verified legitimate activity",
      });
      expect(unfrozen.status).toBe("ACTIVE");
      expect(mockDb.accounts.get("acc-user1").status).toBe("ACTIVE");
    });

    it("configures and retrieves custom user limits", async () => {
      await adminService.setUserLimits({
        userId: "user-1",
        dailySendLimit: 10000000n, // 100,000 BDT
        perTxnLimit: 5000000n,    // 50,000 BDT
        monthlyLimit: 50000000n,  // 500,000 BDT
      });

      const limits = await adminService.getUserLimits("user-1");
      expect(limits.isDefault).toBe(false);
      expect(limits.perTxnLimit).toBe("5000000");

      const defaultLimits = await adminService.getUserLimits("user-unknown");
      expect(defaultLimits.isDefault).toBe(true);
      expect(defaultLimits.perTxnLimit).toBe("2500000");
    });
  });

  describe("LimitChecker", () => {
    it("enforces daily limits strictly", () => {
      expect(() =>
        LimitChecker.checkLimits({
          amountPoisha: 2000000n, // 20,000 BDT
          limits: { dailySendLimit: 5000000n }, // 50,000 BDT
          currentDailyTotal: 4000000n, // 40,000 already spent
        })
      ).toThrow("Transaction would exceed daily limit of 50000 Taka");
    });

    it("enforces monthly limits strictly", () => {
      expect(() =>
        LimitChecker.checkLimits({
          amountPoisha: 2000000n,
          limits: { monthlyLimit: 10000000n },
          currentMonthlyTotal: 9000000n,
        })
      ).toThrow("Transaction would exceed monthly limit of 100000 Taka");
    });
  });
});
