import { describe, it, expect, beforeEach } from "@jest/globals";
import crypto from "node:crypto";
import { TopUpService } from "../../src/services/topUpService.js";
import { TransferService } from "../../src/services/transferService.js";
import { WalletService } from "../../src/services/walletService.js";
import { generateWebhookSignature } from "../../../mock-provider/src/utils/signature.js";

function createMockDb() {
  const accounts = new Map([
    ["acc-alice", { id: "acc-alice", owner_id: "user-alice", type: "USER_WALLET", balance: 100000n, status: "ACTIVE", currency: "BDT" }],
    ["acc-bob", { id: "acc-bob", owner_id: "user-bob", type: "USER_WALLET", balance: 20000n, status: "ACTIVE", currency: "BDT" }],
    ["acc-bank", { id: "acc-bank", owner_id: null, type: "SYSTEM_BANK_CLEARING", balance: 0n, status: "ACTIVE", currency: "BDT" }],
    ["acc-fee", { id: "acc-fee", owner_id: null, type: "SYSTEM_FEE_REVENUE", balance: 0n, status: "ACTIVE", currency: "BDT" }],
  ]);

  const topUps = new Map();
  const idempotencyKeys = new Map();
  const journalEntries = new Map();
  const ledgerLines = [];

  const mockClient = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      // Top-up insert
      if (s.startsWith("INSERT INTO top_ups")) {
        const id = `topup-${Date.now()}`;
        const record = {
          id,
          user_id: params[0],
          amount: BigInt(params[1]),
          provider_ref: params[2],
          status: params[3] || "INITIATED",
          created_at: new Date(),
          completed_at: null,
        };
        topUps.set(record.provider_ref, record);
        return { rows: [record] };
      }

      // Top-up select by provider_ref
      if (s.startsWith("SELECT") && s.includes("FROM top_ups WHERE provider_ref = $1")) {
        const rec = topUps.get(params[0]);
        return { rows: rec ? [{ ...rec, amount: rec.amount.toString() }] : [] };
      }

      // Top-up update status
      if (s.startsWith("UPDATE top_ups SET status =")) {
        for (const rec of topUps.values()) {
          if (rec.id === params[1] || rec.id === params[0]) {
            rec.status = s.includes("'COMPLETED'") ? "COMPLETED" : "FAILED";
            rec.completed_at = new Date();
          }
        }
        return { rowCount: 1 };
      }

      // Accounts lookup
      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'")) {
        const acc = Array.from(accounts.values()).find(
          (a) => (a.owner_id === params[0] || a.id === params[0]) && a.type === "USER_WALLET"
        );
        return { rows: acc ? [{ ...acc, balance: acc.balance.toString() }] : [] };
      }

      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE type = 'SYSTEM_BANK_CLEARING'")) {
        return { rows: [{ id: "acc-bank" }] };
      }

      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE type = 'SYSTEM_FEE_REVENUE'")) {
        return { rows: [{ id: "acc-fee" }] };
      }

      // Accounts FOR UPDATE (locking)
      if (s.startsWith("SELECT") && s.includes("FROM accounts") && s.includes("FOR UPDATE")) {
        const ids = params[0];
        const rows = ids
          .map((id) => accounts.get(id))
          .filter(Boolean)
          .map((a) => ({ ...a, balance: a.balance.toString() }));
        return { rows };
      }

      // Idempotency keys lookup
      if (s.startsWith("SELECT") && s.includes("FROM idempotency_keys WHERE key = $1")) {
        const rec = idempotencyKeys.get(`${params[0]}-${params[1]}`);
        return { rows: rec ? [rec] : [] };
      }

      // Idempotency keys insert
      if (s.startsWith("INSERT INTO idempotency_keys")) {
        const rec = {
          key: params[0],
          user_id: params[1],
          request_hash: params[2],
          response: typeof params[3] === "string" ? JSON.parse(params[3]) : params[3],
          status_code: params[4],
        };
        idempotencyKeys.set(`${params[0]}-${params[1]}`, rec);
        return { rows: [rec] };
      }

      // Journal entry insert
      if (s.startsWith("INSERT INTO journal_entries")) {
        const entry = {
          id: params[0],
          type: params[1],
          status: params[2],
          reference: params[3],
          description: params[4],
          created_at: new Date(),
        };
        journalEntries.set(params[0], entry);
        return { rows: [entry] };
      }

      // Ledger lines insert
      if (s.startsWith("INSERT INTO ledger_lines")) {
        const line = {
          id: ledgerLines.length + 1,
          entry_id: params[0],
          account_id: params[1],
          direction: params[2],
          amount: params[3],
          created_at: new Date(),
        };
        ledgerLines.push(line);
        return { rows: [line] };
      }

      // Account balance update
      if (s.startsWith("UPDATE accounts") && s.includes("SET balance = balance + $1")) {
        const delta = BigInt(params[0]);
        const acc = accounts.get(params[1]);
        if (acc) acc.balance += delta;
        return { rowCount: 1 };
      }

      // Wallet transactions history
      if (s.startsWith("SELECT") && s.includes("FROM ledger_lines l") && s.includes("JOIN journal_entries j")) {
        const accId = params[0];
        const rows = ledgerLines
          .filter((l) => l.account_id === accId)
          .map((l) => {
            const j = journalEntries.get(l.entry_id);
            return {
              entry_id: l.entry_id,
              type: j?.type || "P2P",
              status: j?.status || "COMPLETED",
              reference: j?.reference || "ref",
              description: j?.description || "",
              direction: l.direction,
              amount: l.amount,
              created_at: l.created_at,
            };
          });
        return { rows };
      }

      return { rows: [] };
    },
  };

  return { accounts, topUps, idempotencyKeys, mockClient };
}

describe("Transfer & Top-Up Service Integration", () => {
  const dummySecret = "test-secret-not-real-webhook-key-min-32-chars";
  let mockDb;
  let topUpService;
  let transferService;
  let walletService;

  beforeEach(() => {
    mockDb = createMockDb();
    topUpService = new TopUpService(undefined, { connect: () => mockDb.mockClient });
    transferService = new TransferService(undefined, { connect: () => mockDb.mockClient });
    walletService = new WalletService({ connect: () => mockDb.mockClient });
  });

  describe("Top-Up Flow", () => {
    it("initiates top-up and processes signed webhook callback successfully", async () => {
      // 1. Initiate Top-Up
      const initiated = await topUpService.initiateTopUp({
        userId: "user-alice",
        amountPoisha: 50000n, // 500 Taka
        providerRef: "prov-ref-alice-1",
        customClient: mockDb.mockClient,
      });

      expect(initiated.provider_ref).toBe("prov-ref-alice-1");
      expect(initiated.status).toBe("INITIATED");

      // 2. Generate HMAC signed provider callback
      const callbackPayload = {
        providerRef: "prov-ref-alice-1",
        topUpId: initiated.id,
        status: "SUCCESS",
        amount: "50000",
      };
      const timestamp = Math.floor(Date.now() / 1000);
      const { signature } = generateWebhookSignature(callbackPayload, dummySecret, timestamp);

      // 3. Handle Webhook
      const webhookRes = await topUpService.handleWebhook({
        payload: callbackPayload,
        signature,
        timestamp,
        webhookSecret: dummySecret,
        customClient: mockDb.mockClient,
      });

      expect(webhookRes.success).toBe(true);
      expect(webhookRes.status).toBe("COMPLETED");

      // Verify Alice's balance increased by 50,000 poisha (100,000 -> 150,000)
      expect(mockDb.accounts.get("acc-alice").balance).toBe(150000n);
    });

    it("rejects webhook with invalid signature", async () => {
      const payload = { providerRef: "prov-fake", status: "SUCCESS", amount: "50000" };
      await expect(
        topUpService.handleWebhook({
          payload,
          signature: "invalid-signature",
          timestamp: Math.floor(Date.now() / 1000),
          webhookSecret: dummySecret,
          customClient: mockDb.mockClient,
        })
      ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    });
  });

  describe("P2P Transfers & Idempotency", () => {
    it("executes P2P transfer atomically and updates balances", async () => {
      const res = await transferService.transferP2P({
        senderUserId: "user-alice",
        receiverPhone: "user-bob",
        amountPoisha: 10000n, // 100 Taka
        idempotencyKey: "idem-key-1",
        customClient: mockDb.mockClient,
      });

      expect(res.fromCache).toBe(false);
      expect(res.data.status).toBe("COMPLETED");

      // Sender deducted: 10,000 + 500 fee = 10,500 deducted -> 100,000 - 10,500 = 89,500
      expect(mockDb.accounts.get("acc-alice").balance).toBe(89500n);
      // Receiver credited: 10,000 added -> 20,000 + 10,000 = 30,000
      expect(mockDb.accounts.get("acc-bob").balance).toBe(30000n);
      // Fee credited: 500 poisha
      expect(mockDb.accounts.get("acc-fee").balance).toBe(500n);
    });

    it("returns identical cached response on duplicate idempotent retry", async () => {
      // First attempt
      const first = await transferService.transferP2P({
        senderUserId: "user-alice",
        receiverPhone: "user-bob",
        amountPoisha: 10000n,
        idempotencyKey: "idem-key-2",
        customClient: mockDb.mockClient,
      });

      expect(first.fromCache).toBe(false);

      // Replay identical attempt
      const second = await transferService.transferP2P({
        senderUserId: "user-alice",
        receiverPhone: "user-bob",
        amountPoisha: 10000n,
        idempotencyKey: "idem-key-2",
        customClient: mockDb.mockClient,
      });

      expect(second.fromCache).toBe(true);
      expect(second.data.transactionId).toBe(first.data.transactionId);
    });

    it("rejects same idempotency key with different body (409 Conflict)", async () => {
      // First call with amount 10000n
      await transferService.transferP2P({
        senderUserId: "user-alice",
        receiverPhone: "user-bob",
        amountPoisha: 10000n,
        idempotencyKey: "idem-key-3",
        customClient: mockDb.mockClient,
      });

      // Second call with DIFFERENT amount 20000n
      await expect(
        transferService.transferP2P({
          senderUserId: "user-alice",
          receiverPhone: "user-bob",
          amountPoisha: 20000n, // Different amount
          idempotencyKey: "idem-key-3",
          customClient: mockDb.mockClient,
        })
      ).rejects.toMatchObject({
        code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY",
      });
    });
  });

  describe("Wallet Balance & History", () => {
    it("returns formatted balance for user", async () => {
      const balance = await walletService.getBalance({
        userId: "user-alice",
        customClient: mockDb.mockClient,
      });

      expect(balance.balancePoisha).toBe("100000");
      expect(balance.balanceTaka).toBe("1000.00");
      expect(balance.formatted).toBe("৳ 1,000.00");
    });

    it("returns transactions with correct pagination hasMore and nextCursor", async () => {
      const history = await walletService.getTransactions({
        userId: "user-alice",
        limit: 20,
        customClient: mockDb.mockClient,
      });

      expect(Array.isArray(history.items)).toBe(true);
      expect(history.hasMore).toBe(false);
      expect(history.nextCursor).toBeNull();
    });
  });
});
