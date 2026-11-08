import { describe, it, expect, beforeEach } from "@jest/globals";
import crypto from "node:crypto";
import request from "supertest";
import { MerchantService } from "../../src/services/merchantService.js";
import { CashOutService } from "../../src/services/cashOutService.js";
import { PayeeService } from "../../src/services/payeeService.js";
import { MerchantQr } from "../../src/utils/merchantQr.js";
import { LedgerRepository } from "../../src/repositories/ledgerRepository.js";
import { createApp } from "../../src/app.js";

function createMockDb() {
  const accounts = new Map([
    [
      "acc-user1",
      { id: "acc-user1", owner_id: "user-1", type: "USER_WALLET", balance: 500000n, status: "ACTIVE", currency: "BDT", version: 1 },
    ],
    [
      "acc-user2",
      { id: "acc-user2", owner_id: "user-2", type: "USER_WALLET", balance: 100000n, status: "ACTIVE", currency: "BDT", version: 1 },
    ],
    [
      "acc-fee",
      { id: "acc-fee", owner_id: null, type: "SYSTEM_FEE_REVENUE", balance: 0n, status: "ACTIVE", currency: "BDT", version: 1 },
    ],
    [
      "acc-agent",
      { id: "acc-agent", owner_id: null, type: "SYSTEM_AGENT_CASH", balance: 0n, status: "ACTIVE", currency: "BDT", version: 1 },
    ],
  ]);

  const merchants = new Map();
  const payees = new Map();
  const idempotencyKeys = new Map();
  const journalEntries = new Map();
  const ledgerLines = [];

  const mockClient = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      // Accounts lookup by owner & type
      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'")) {
        const acc = Array.from(accounts.values()).find(
          (a) => a.owner_id === params[0] && a.type === "USER_WALLET"
        );
        return { rows: acc ? [{ ...acc, balance: acc.balance.toString() }] : [] };
      }

      // Accounts lookup by ID
      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE id = $1")) {
        const acc = accounts.get(params[0]);
        return { rows: acc ? [{ ...acc, balance: acc.balance.toString() }] : [] };
      }

      // System accounts
      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE type = 'SYSTEM_FEE_REVENUE'")) {
        return { rows: [{ id: "acc-fee" }] };
      }
      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE type = 'SYSTEM_AGENT_CASH'")) {
        return { rows: [{ id: "acc-agent" }] };
      }

      // Accounts create
      if (s.startsWith("INSERT INTO accounts")) {
        const id = `acc-gen-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const acc = {
          id,
          owner_id: params[0] || null,
          type: s.includes("'MERCHANT_WALLET'") ? "MERCHANT_WALLET" : params[1] || "USER_WALLET",
          currency: "BDT",
          balance: 0n,
          status: "ACTIVE",
          version: 1,
        };
        accounts.set(id, acc);
        return { rows: [{ ...acc, balance: acc.balance.toString() }] };
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

      // Merchants insert
      if (s.startsWith("INSERT INTO merchants")) {
        const merchant = {
          id: params[0],
          owner_id: params[1],
          name: params[2],
          account_id: params[3],
          qr_code: params[4],
          status: "ACTIVE",
          created_at: new Date(),
        };
        merchants.set(merchant.id, merchant);
        return { rows: [merchant] };
      }

      // Merchants lookup by ID with account join
      if (s.startsWith("SELECT") && s.includes("FROM merchants m") && s.includes("WHERE m.id = $1")) {
        const m = merchants.get(params[0]);
        if (!m) return { rows: [] };
        const a = accounts.get(m.account_id);
        return {
          rows: [
            {
              id: m.id,
              owner_id: m.owner_id,
              name: m.name,
              account_id: m.account_id,
              qr_code: m.qr_code,
              status: m.status,
              merchant_status: m.status,
              created_at: m.created_at,
              balance: a ? a.balance.toString() : "0",
              currency: a ? a.currency : "BDT",
              account_status: a ? a.status : "ACTIVE",
            },
          ],
        };
      }

      // Payees insert/upsert
      if (s.startsWith("INSERT INTO payees")) {
        const id = `payee-${Date.now()}`;
        const p = {
          id,
          user_id: params[0],
          payee_account_id: params[1],
          nickname: params[2],
          first_used_at: new Date(),
          created_at: new Date(),
        };
        payees.set(`${p.user_id}-${p.payee_account_id}`, p);
        return { rows: [p] };
      }

      // Payees select
      if (s.startsWith("SELECT") && s.includes("FROM payees p")) {
        const list = Array.from(payees.values()).filter((p) => p.user_id === params[0]);
        return {
          rows: list.map((p) => {
            const acc = accounts.get(p.payee_account_id);
            return {
              ...p,
              payee_user_id: acc ? acc.owner_id : null,
              account_type: acc ? acc.type : "USER_WALLET",
              account_status: acc ? acc.status : "ACTIVE",
            };
          }),
        };
      }

      // Payees delete
      if (s.startsWith("DELETE FROM payees WHERE id = $1 AND user_id = $2")) {
        let deleted = false;
        for (const [k, v] of payees.entries()) {
          if (v.id === params[0] && v.user_id === params[1]) {
            payees.delete(k);
            deleted = true;
            break;
          }
        }
        return { rows: deleted ? [{ id: params[0] }] : [] };
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
        idempotencyKeys.set(`${rec.key}-${rec.user_id}`, rec);
        return { rows: [rec] };
      }

      // Journal entry insert
      if (s.startsWith("INSERT INTO journal_entries")) {
        const record = {
          id: params[0],
          type: params[1],
          status: params[2],
          reference: params[3],
          description: params[4],
          reverses_entry_id: params[5],
          created_at: new Date(),
        };
        journalEntries.set(record.id, record);
        return { rows: [record] };
      }

      // Ledger lines insert
      if (s.startsWith("INSERT INTO ledger_lines")) {
        const line = {
          id: ledgerLines.length + 1,
          entry_id: params[0],
          account_id: params[1],
          direction: params[2],
          amount: BigInt(params[3]),
          created_at: new Date(),
        };
        ledgerLines.push(line);
        return { rows: [{ ...line, amount: line.amount.toString() }] };
      }

      // Update cached account balance
      if (s.startsWith("UPDATE accounts") && s.includes("SET balance = balance + $1")) {
        const delta = BigInt(params[0]);
        const accId = params[1];
        const acc = accounts.get(accId);
        if (acc) {
          acc.balance += delta;
          acc.version += 1;
        }
        return { rowCount: 1 };
      }

      return { rows: [] };
    },
    release: () => {},
  };

  const pool = {
    connect: async () => mockClient,
    query: async (sql, params) => mockClient.query(sql, params),
  };

  return { pool, mockClient, accounts, merchants, payees, idempotencyKeys, journalEntries, ledgerLines };
}

describe("Phase 6: Merchant Payments, Cash-Out & Saved Payees", () => {
  let mockDb;
  let ledgerRepo;
  let merchantService;
  let cashOutService;
  let payeeService;

  beforeEach(() => {
    mockDb = createMockDb();
    ledgerRepo = new LedgerRepository(mockDb.pool);
    merchantService = new MerchantService(ledgerRepo, mockDb.pool);
    cashOutService = new CashOutService(ledgerRepo, mockDb.pool);
    payeeService = new PayeeService(mockDb.pool);
  });

  describe("MerchantQr utility", () => {
    it("generates and verifies signed merchant QR code", () => {
      const qrPayload = MerchantQr.generate({
        merchantId: "merch-123",
        accountId: "acc-merch-123",
        name: "Acme Grocery",
        amount: 25000,
        secret: "super-secret-key-for-test-32chars",
      });

      expect(typeof qrPayload).toBe("string");
      const verified = MerchantQr.verify(qrPayload, "super-secret-key-for-test-32chars");
      expect(verified.valid).toBe(true);
      expect(verified.payload.merchantId).toBe("merch-123");
      expect(verified.payload.name).toBe("Acme Grocery");
      expect(verified.payload.amount).toBe("25000");
    });

    it("rejects tampered QR payload", () => {
      const qrPayload = MerchantQr.generate({
        merchantId: "merch-123",
        accountId: "acc-merch-123",
        name: "Acme Grocery",
        secret: "secret-a",
      });

      const decoded = JSON.parse(Buffer.from(qrPayload, "base64").toString("utf-8"));
      decoded.amount = "9999999";
      const tampered = Buffer.from(JSON.stringify(decoded)).toString("base64");

      const res = MerchantQr.verify(tampered, "secret-a");
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Invalid merchant QR code signature/);
    });
  });

  describe("MerchantService", () => {
    it("registers a merchant with an active MERCHANT_WALLET account", async () => {
      const merchant = await merchantService.createMerchant({
        ownerId: "user-merchant-owner",
        name: "Dhaka Electronics",
      });

      expect(merchant.id).toBeDefined();
      expect(merchant.name).toBe("Dhaka Electronics");
      expect(merchant.status).toBe("ACTIVE");
      expect(merchant.qr_code).toBeDefined();
      expect(merchant.account.status).toBe("ACTIVE");
    });

    it("successfully processes merchant payment with 1% fee capped at 50 BDT", async () => {
      const merchant = await merchantService.createMerchant({
        ownerId: "user-merchant-owner",
        name: "Dhaka Electronics",
      });

      const customerBefore = mockDb.accounts.get("acc-user1").balance;
      const amountPoisha = 200000n; // 2,000.00 BDT
      // 1.00% fee = 20.00 BDT = 2000 poisha

      const res = await merchantService.payMerchant({
        customerUserId: "user-1",
        merchantId: merchant.id,
        amountPoisha,
        idempotencyKey: "merch-pay-key-1",
      });

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe("COMPLETED");
      expect(res.data.amount).toBe("200000");
      expect(res.data.fee).toBe("2000");

      const customerAfter = mockDb.accounts.get("acc-user1").balance;
      const merchantAcc = mockDb.accounts.get(merchant.account_id);
      const feeAcc = mockDb.accounts.get("acc-fee");

      expect(customerAfter).toBe(customerBefore - 200000n - 2000n);
      expect(merchantAcc.balance).toBe(200000n);
      expect(feeAcc.balance).toBe(2000n);
    });

    it("idempotently returns cached response on duplicate merchant payment requests", async () => {
      const merchant = await merchantService.createMerchant({
        ownerId: "user-merchant-owner",
        name: "Dhaka Electronics",
      });

      const req = {
        customerUserId: "user-1",
        merchantId: merchant.id,
        amountPoisha: 10000n,
        idempotencyKey: "dup-merch-key",
      };

      const first = await merchantService.payMerchant(req);
      const second = await merchantService.payMerchant(req);

      expect(first.fromCache).toBe(false);
      expect(second.fromCache).toBe(true);
      expect(second.data.transactionId).toBe(first.data.transactionId);
    });

    it("prevents paying one's own merchant account", async () => {
      const merchant = await merchantService.createMerchant({
        ownerId: "user-1",
        name: "My Own Store",
      });

      await expect(
        merchantService.payMerchant({
          customerUserId: "user-1",
          merchantId: merchant.id,
          amountPoisha: 10000n,
          idempotencyKey: "self-pay-key",
        })
      ).rejects.toThrow("Cannot pay your own merchant account");
    });
  });

  describe("CashOutService", () => {
    it("successfully processes cash-out with 1.85% fee and credits agent cash", async () => {
      const userBefore = mockDb.accounts.get("acc-user1").balance;
      const amountPoisha = 100000n; // 1,000.00 BDT
      // 1.85% of 100000 = 1850 poisha

      const res = await cashOutService.cashOut({
        userId: "user-1",
        amountPoisha,
        idempotencyKey: "cashout-key-1",
      });

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe("COMPLETED");
      expect(res.data.amount).toBe("100000");
      expect(res.data.fee).toBe("1850");

      const userAfter = mockDb.accounts.get("acc-user1").balance;
      const agentAcc = mockDb.accounts.get("acc-agent");
      const feeAcc = mockDb.accounts.get("acc-fee");

      expect(userAfter).toBe(userBefore - 100000n - 1850n);
      expect(agentAcc.balance).toBe(100000n);
      expect(feeAcc.balance).toBe(1850n);
    });

    it("rejects cash-out with insufficient user balance", async () => {
      await expect(
        cashOutService.cashOut({
          userId: "user-2", // has 100,000 poisha
          amountPoisha: 500000n, // exceeds balance
          idempotencyKey: "cashout-fail-key",
        })
      ).rejects.toThrow(/Insufficient funds/);
    });
  });

  describe("PayeeService", () => {
    it("adds, lists, and deletes saved payees", async () => {
      const added = await payeeService.addPayee({
        userId: "user-1",
        payeeAccountId: "acc-user2",
        nickname: "Mom's Wallet",
      });

      expect(added.nickname).toBe("Mom's Wallet");

      const list = await payeeService.listPayees({ userId: "user-1" });
      expect(list.length).toBe(1);
      expect(list[0].nickname).toBe("Mom's Wallet");

      const deleted = await payeeService.deletePayee({
        userId: "user-1",
        payeeId: added.id,
      });
      expect(deleted.deleted).toBe(true);

      const afterDelete = await payeeService.listPayees({ userId: "user-1" });
      expect(afterDelete.length).toBe(0);
    });

    it("prevents adding own account as payee", async () => {
      await expect(
        payeeService.addPayee({
          userId: "user-1",
          payeeAccountId: "acc-user1",
          nickname: "My Own Self",
        })
      ).rejects.toThrow("Cannot add your own account as a payee");
    });
  });

  describe("HTTP Routes (Supertest)", () => {
    it("POST /api/merchants and POST /api/payments/merchant", async () => {
      const app = createApp({
        merchantService,
        cashOutService,
        payeeService,
      });

      // 1. Create merchant
      const merchRes = await request(app)
        .post("/api/merchants")
        .set("x-user-id", "owner-abc")
        .send({ name: "Coffee Shop" });

      expect(merchRes.status).toBe(201);
      expect(merchRes.body.success).toBe(true);
      const merchantId = merchRes.body.data.id;
      const qrCode = merchRes.body.data.qr_code;

      // 2. Pay merchant with QR code
      const payRes = await request(app)
        .post("/api/payments/merchant")
        .set("x-user-id", "user-1")
        .set("idempotency-key", "api-merch-pay-1")
        .send({
          qrPayload: qrCode,
          amount: 50000,
        });

      expect(payRes.status).toBe(200);
      expect(payRes.body.success).toBe(true);
      expect(payRes.body.data.merchantId).toBe(merchantId);

      // 3. Cash out via API
      const cashOutRes = await request(app)
        .post("/api/cash-out")
        .set("x-user-id", "user-1")
        .set("idempotency-key", "api-cashout-1")
        .send({
          amount: 25000,
        });

      expect(cashOutRes.status).toBe(200);
      expect(cashOutRes.body.success).toBe(true);
      expect(cashOutRes.body.data.amount).toBe("25000");

      // 4. Payees via API
      const addPayeeRes = await request(app)
        .post("/api/payees")
        .set("x-user-id", "user-1")
        .send({
          payeeAccountId: "acc-user2",
          nickname: "Colleague Bob",
        });

      expect(addPayeeRes.status).toBe(201);
      expect(addPayeeRes.body.data.nickname).toBe("Colleague Bob");

      const getPayeesRes = await request(app)
        .get("/api/payees")
        .set("x-user-id", "user-1");

      expect(getPayeesRes.status).toBe(200);
      expect(getPayeesRes.body.data.length).toBe(1);
    });
  });
});
