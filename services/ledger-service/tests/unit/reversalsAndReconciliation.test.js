import { describe, it, expect, beforeEach } from "@jest/globals";
import crypto from "node:crypto";
import request from "supertest";
import { ReversalService } from "../../src/services/reversalService.js";
import { ReconciliationService } from "../../src/services/reconciliationService.js";
import { AdminService } from "../../src/services/adminService.js";
import { createApp } from "../../src/app.js";

function createMockDb() {
  const accounts = new Map([
    [
      "acc-user1",
      { id: "acc-user1", owner_id: "user-1", type: "USER_WALLET", balance: 500000n, status: "ACTIVE", version: 1 },
    ],
    [
      "acc-user2",
      { id: "acc-user2", owner_id: "user-2", type: "USER_WALLET", balance: 200000n, status: "ACTIVE", version: 1 },
    ],
    [
      "acc-fee",
      { id: "acc-fee", owner_id: null, type: "SYSTEM_FEE_REVENUE", balance: 1000n, status: "ACTIVE", version: 1 },
    ],
  ]);

  const journalEntries = new Map();
  const ledgerLines = [];
  const auditLogs = [];
  const reconciliationReports = [];
  const outbox = [];
  const limits = new Map();

  let lineIdSeq = 1;

  const mockClient = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      // Reversal: Lock and fetch original journal entry
      if (s.includes("SELECT * FROM journal_entries WHERE id = $1 FOR UPDATE")) {
        const entry = journalEntries.get(params[0]);
        return { rows: entry ? [{ ...entry }] : [] };
      }

      // Check existing reversal
      if (s.includes("SELECT id FROM journal_entries WHERE reverses_entry_id = $1 LIMIT 1")) {
        const found = Array.from(journalEntries.values()).find((e) => e.reverses_entry_id === params[0]);
        return { rows: found ? [{ id: found.id }] : [] };
      }

      // Fetch ledger lines for entry
      if (s.includes("SELECT id, entry_id, account_id, direction, amount FROM ledger_lines WHERE entry_id = $1")) {
        const lines = ledgerLines.filter((l) => l.entry_id === params[0]);
        return { rows: lines.map((l) => ({ ...l, amount: l.amount.toString() })) };
      }

      // Lock accounts in order
      if (s.includes("FROM accounts") && s.includes("WHERE id = ANY($1::uuid[])")) {
        const ids = params[0];
        const matched = [];
        for (const id of ids) {
          if (accounts.has(id)) {
            const acc = accounts.get(id);
            matched.push({ ...acc, balance: acc.balance.toString() });
          }
        }
        matched.sort((a, b) => a.id.localeCompare(b.id));
        return { rows: matched };
      }

      // Accounts lookup by ID or owner
      if (s.includes("SELECT id FROM accounts WHERE owner_id = $1")) {
        const acc = Array.from(accounts.values()).find((a) => a.owner_id === params[0]);
        return { rows: acc ? [{ id: acc.id }] : [] };
      }

      if (s.includes("SELECT * FROM accounts WHERE id = $1")) {
        const acc = accounts.get(params[0]);
        return { rows: acc ? [{ ...acc, balance: acc.balance.toString() }] : [] };
      }

      // Update account status (freeze / unfreeze)
      if (s.includes("UPDATE accounts") && s.includes("SET status = 'FROZEN'")) {
        const acc = accounts.get(params[0]);
        if (!acc) return { rows: [] };
        acc.status = "FROZEN";
        return { rows: [{ ...acc, balance: acc.balance.toString(), updated_at: new Date() }] };
      }

      if (s.includes("UPDATE accounts") && s.includes("SET status = 'ACTIVE'")) {
        const acc = accounts.get(params[0]);
        if (!acc) return { rows: [] };
        acc.status = "ACTIVE";
        return { rows: [{ ...acc, balance: acc.balance.toString(), updated_at: new Date() }] };
      }

      // Update cached account balance
      if (s.includes("UPDATE accounts") && s.includes("SET balance = balance + $1")) {
        const delta = BigInt(params[0]);
        const accId = params[1];
        const acc = accounts.get(accId);
        if (acc) {
          acc.balance += delta;
          acc.version += 1;
        }
        return { rows: [] };
      }

      // Insert reversal journal entry
      if (s.includes("INSERT INTO journal_entries")) {
        const entry = {
          id: params[0],
          type: params[1],
          status: params[2],
          reference: params[3],
          description: params[4],
          reverses_entry_id: params[5],
          initiated_by: params[6],
          created_at: new Date(),
        };
        journalEntries.set(entry.id, entry);
        return { rows: [{ ...entry }] };
      }

      // Update original journal entry to REVERSED
      if (s.includes("UPDATE journal_entries SET status = 'REVERSED' WHERE id = $1")) {
        const entry = journalEntries.get(params[0]);
        if (entry) entry.status = "REVERSED";
        return { rows: [] };
      }

      // Insert ledger lines
      if (s.includes("INSERT INTO ledger_lines")) {
        const line = {
          id: lineIdSeq++,
          entry_id: params[0],
          account_id: params[1],
          direction: params[2],
          amount: BigInt(params[3]),
          created_at: new Date(),
        };
        ledgerLines.push(line);
        return { rows: [{ ...line, amount: line.amount.toString() }] };
      }

      // Insert audit logs
      if (s.includes("INSERT INTO audit_logs")) {
        const log = {
          id: crypto.randomUUID(),
          actor_id: params[0],
          action: params[1],
          entity: params[2],
          entity_id: params[3],
          metadata: JSON.parse(params[4] || "{}"),
          created_at: new Date(),
        };
        auditLogs.push(log);
        return { rows: [log] };
      }

      // Fetch audit logs
      if (s.includes("FROM audit_logs")) {
        return { rows: [...auditLogs].reverse() };
      }

      // Insert outbox
      if (s.includes("INSERT INTO outbox")) {
        const item = {
          id: outbox.length + 1,
          topic: params[0],
          payload: JSON.parse(params[1]),
          created_at: new Date(),
        };
        outbox.push(item);
        return { rows: [item] };
      }

      // Reconciliation totals
      if (s.includes("FROM ledger_lines") && s.includes("SUM(CASE WHEN direction = 'DEBIT'")) {
        let debits = 0n;
        let credits = 0n;
        for (const l of ledgerLines) {
          if (l.direction === "DEBIT") debits += l.amount;
          else credits += l.amount;
        }
        return {
          rows: [
            {
              total_debits: debits.toString(),
              total_credits: credits.toString(),
            },
          ],
        };
      }

      // Reconciliation accounts balance check
      if (s.includes("FROM accounts a") && s.includes("LEFT JOIN ledger_lines l")) {
        const rows = [];
        for (const acc of accounts.values()) {
          let calculated = 0n;
          for (const l of ledgerLines) {
            if (l.account_id === acc.id) {
              if (l.direction === "CREDIT") calculated += l.amount;
              else calculated -= l.amount;
            }
          }
          rows.push({
            id: acc.id,
            owner_id: acc.owner_id,
            type: acc.type,
            cached_balance: acc.balance.toString(),
            calculated_balance: calculated.toString(),
          });
        }
        return { rows };
      }

      // Insert reconciliation report
      if (s.includes("INSERT INTO reconciliation_reports")) {
        const report = {
          id: crypto.randomUUID(),
          status: params[0],
          total_accounts: params[1],
          balanced_accounts: params[2],
          discrepancy_accounts: params[3],
          total_system_balance: params[4],
          total_debits: params[5],
          total_credits: params[6],
          details: JSON.parse(params[7]),
          created_at: new Date(),
        };
        reconciliationReports.push(report);
        return { rows: [report] };
      }

      // Latest reconciliation report
      if (s.includes("FROM reconciliation_reports ORDER BY created_at DESC LIMIT 1")) {
        const latest = reconciliationReports[reconciliationReports.length - 1];
        return { rows: latest ? [latest] : [] };
      }

      // Reconciliation reports list
      if (s.includes("FROM reconciliation_reports ORDER BY created_at DESC")) {
        return { rows: [...reconciliationReports].reverse() };
      }

      // Admin stats
      if (s.includes("SELECT") && s.includes("COUNT(*) AS total_accounts")) {
        return {
          rows: [
            {
              total_accounts: accounts.size.toString(),
              active_accounts: Array.from(accounts.values()).filter((a) => a.status === "ACTIVE").length.toString(),
              frozen_accounts: Array.from(accounts.values()).filter((a) => a.status === "FROZEN").length.toString(),
              user_wallets: Array.from(accounts.values()).filter((a) => a.type === "USER_WALLET").length.toString(),
              merchant_wallets: Array.from(accounts.values()).filter((a) => a.type === "MERCHANT_WALLET").length.toString(),
            },
          ],
        };
      }

      if (s.includes("SELECT") && s.includes("FROM journal_entries") && s.includes("GROUP BY type")) {
        const counts = {};
        for (const e of journalEntries.values()) {
          counts[e.type] = counts[e.type] || { count: 0, completed: 0, reversed: 0 };
          counts[e.type].count++;
          if (e.status === "COMPLETED") counts[e.type].completed++;
          if (e.status === "REVERSED") counts[e.type].reversed++;
        }
        const rows = Object.entries(counts).map(([type, c]) => ({
          type,
          count: c.count,
          completed_count: c.completed,
          reversed_count: c.reversed,
        }));
        return { rows };
      }

      if (s.includes("SELECT") && s.includes("total_volume") && s.includes("volume_24h")) {
        return {
          rows: [
            {
              total_volume: "50000",
              volume_24h: "50000",
            },
          ],
        };
      }

      if (s.includes("WHERE type = 'SYSTEM_FEE_REVENUE'")) {
        const feeAcc = accounts.get("acc-fee");
        return { rows: feeAcc ? [{ balance: feeAcc.balance.toString() }] : [] };
      }

      // Limits
      if (s.includes("INSERT INTO limits")) {
        const limitObj = {
          user_id: params[0],
          daily_send_limit: params[1],
          per_txn_limit: params[2],
          monthly_limit: params[3],
          updated_at: new Date(),
        };
        limits.set(limitObj.user_id, limitObj);
        return { rows: [limitObj] };
      }

      if (s.includes("SELECT * FROM limits WHERE user_id = $1")) {
        const lim = limits.get(params[0]);
        return { rows: lim ? [lim] : [] };
      }

      return { rows: [] };
    },
    release: () => {},
  };

  const mockPool = {
    connect: async () => mockClient,
    query: async (sql, params) => mockClient.query(sql, params),
  };

  return {
    accounts,
    journalEntries,
    ledgerLines,
    auditLogs,
    reconciliationReports,
    outbox,
    mockPool,
  };
}

describe("Phase 9: Reversals, Reconciliation & Admin Service", () => {
  let mockDb;
  let reversalService;
  let reconciliationService;
  let adminService;
  let app;

  beforeEach(() => {
    mockDb = createMockDb();
    reversalService = new ReversalService(mockDb.mockPool);
    reconciliationService = new ReconciliationService(mockDb.mockPool);
    adminService = new AdminService(mockDb.mockPool);
    app = createApp({
      adminService,
      reversalService,
      reconciliationService,
    });
  });

  describe("ReversalService (Compensating Entries)", () => {
    it("successfully creates a compensating reversal entry and restores balances", async () => {
      // Setup original P2P transfer: user1 sent 100 BDT (10,000 poisha) to user2
      const originalEntryId = crypto.randomUUID();
      mockDb.journalEntries.set(originalEntryId, {
        id: originalEntryId,
        type: "P2P",
        status: "COMPLETED",
        reference: "TXN-P2P-123",
        reverses_entry_id: null,
      });

      // Original lines: user1 DEBIT 10000, user2 CREDIT 10000
      mockDb.ledgerLines.push(
        { id: 1, entry_id: originalEntryId, account_id: "acc-user1", direction: "DEBIT", amount: 10000n },
        { id: 2, entry_id: originalEntryId, account_id: "acc-user2", direction: "CREDIT", amount: 10000n }
      );

      const beforeUser1 = mockDb.accounts.get("acc-user1").balance;
      const beforeUser2 = mockDb.accounts.get("acc-user2").balance;

      const result = await reversalService.reverseTransaction({
        entryId: originalEntryId,
        actorId: "admin-uuid-1",
        reason: "Customer dispute accepted",
      });

      expect(result.originalEntryId).toBe(originalEntryId);
      expect(result.reversalEntry.type).toBe("REVERSAL");
      expect(result.reversalEntry.reverses_entry_id).toBe(originalEntryId);
      expect(result.reversalLines.length).toBe(2);

      // Check lines swapped
      const user1RevLine = result.reversalLines.find((l) => l.account_id === "acc-user1");
      const user2RevLine = result.reversalLines.find((l) => l.account_id === "acc-user2");
      expect(user1RevLine.direction).toBe("CREDIT");
      expect(user2RevLine.direction).toBe("DEBIT");
      expect(user1RevLine.amount).toBe("10000");
      expect(user2RevLine.amount).toBe("10000");

      // Verify cached balances restored
      expect(mockDb.accounts.get("acc-user1").balance).toBe(beforeUser1 + 10000n);
      expect(mockDb.accounts.get("acc-user2").balance).toBe(beforeUser2 - 10000n);

      // Original entry marked REVERSED
      expect(mockDb.journalEntries.get(originalEntryId).status).toBe("REVERSED");

      // Verify audit log recorded
      expect(mockDb.auditLogs.length).toBe(1);
      expect(mockDb.auditLogs[0].action).toBe("REVERSE_TRANSACTION");
      expect(mockDb.auditLogs[0].actor_id).toBe("admin-uuid-1");

      // Verify outbox event emitted
      expect(mockDb.outbox.length).toBe(1);
      expect(mockDb.outbox[0].topic).toBe("TRANSACTION_REVERSED");
    });

    it("prevents double reversal of the same transaction", async () => {
      const entryId = crypto.randomUUID();
      mockDb.journalEntries.set(entryId, {
        id: entryId,
        type: "P2P",
        status: "REVERSED",
        reference: "TXN-REV-ALREADY",
      });

      await expect(
        reversalService.reverseTransaction({
          entryId,
          actorId: "admin-1",
        })
      ).rejects.toThrow("already been reversed");
    });

    it("prevents reversal of a REVERSAL transaction itself", async () => {
      const entryId = crypto.randomUUID();
      mockDb.journalEntries.set(entryId, {
        id: entryId,
        type: "REVERSAL",
        status: "COMPLETED",
        reference: "TXN-REV-001",
      });

      await expect(
        reversalService.reverseTransaction({
          entryId,
          actorId: "admin-1",
        })
      ).rejects.toThrow("Cannot reverse a reversal transaction");
    });

    it("blocks reversal if destination account lacks sufficient funds to debit", async () => {
      const entryId = crypto.randomUUID();
      mockDb.journalEntries.set(entryId, {
        id: entryId,
        type: "P2P",
        status: "COMPLETED",
        reference: "TXN-OVERDRAFT",
      });

      // User 2 only has 500 poisha, but reversal requires debiting 10,000 poisha
      mockDb.accounts.get("acc-user2").balance = 500n;
      mockDb.ledgerLines.push(
        { id: 1, entry_id: entryId, account_id: "acc-user1", direction: "DEBIT", amount: 10000n },
        { id: 2, entry_id: entryId, account_id: "acc-user2", direction: "CREDIT", amount: 10000n }
      );

      await expect(
        reversalService.reverseTransaction({
          entryId,
          actorId: "admin-1",
        })
      ).rejects.toThrow("Insufficient funds in account acc-user2");
    });
  });

  describe("ReconciliationService", () => {
    it("reports BALANCED when cached balances equal sum of ledger lines and debits equal credits", async () => {
      const entry1 = crypto.randomUUID();
      mockDb.ledgerLines.push(
        { id: 1, entry_id: entry1, account_id: "acc-user1", direction: "CREDIT", amount: 500000n },
        { id: 2, entry_id: entry1, account_id: "acc-user2", direction: "DEBIT", amount: 500000n }
      );
      mockDb.accounts.get("acc-user1").balance = 500000n;
      mockDb.accounts.get("acc-user2").balance = -500000n;
      mockDb.accounts.get("acc-fee").balance = 0n;

      const report = await reconciliationService.runReconciliation();
      expect(report.status).toBe("BALANCED");
      expect(report.discrepancy_accounts).toBe(0);
      expect(report.balanced_accounts).toBe(3);
      expect(report.total_debits).toBe("500000");
      expect(report.total_credits).toBe("500000");
    });

    it("detects DISCREPANCY when account cached balance does not equal sum of lines", async () => {
      mockDb.accounts.get("acc-user1").balance = 500000n;

      const report = await reconciliationService.runReconciliation();
      expect(report.status).toBe("DISCREPANCY");
      expect(report.discrepancy_accounts).toBeGreaterThan(0);
    });
  });

  describe("AdminService (Freeze, Unfreeze, Audit Logs, Stats)", () => {
    it("freezes and unfreezes account with audit log entries", async () => {
      const freezeRes = await adminService.freezeAccount({
        accountId: "acc-user1",
        reason: "Suspicious activity detected",
        actorId: "admin-actor-42",
      });
      expect(freezeRes.status).toBe("FROZEN");
      expect(mockDb.accounts.get("acc-user1").status).toBe("FROZEN");
      expect(mockDb.auditLogs.length).toBe(1);
      expect(mockDb.auditLogs[0].action).toBe("FREEZE_ACCOUNT");

      const unfreezeRes = await adminService.unfreezeAccount({
        accountId: "acc-user1",
        reason: "KYC verification verified",
        actorId: "admin-actor-42",
      });
      expect(unfreezeRes.status).toBe("ACTIVE");
      expect(mockDb.accounts.get("acc-user1").status).toBe("ACTIVE");
      expect(mockDb.auditLogs.length).toBe(2);
      expect(mockDb.auditLogs[1].action).toBe("UNFREEZE_ACCOUNT");
    });

    it("aggregates platform admin statistics correctly", async () => {
      const stats = await adminService.getAdminStats();
      expect(stats.accounts.total).toBe(3);
      expect(stats.accounts.active).toBe(3);
      expect(stats.accounts.frozen).toBe(0);
      expect(stats.feeRevenuePoisha).toBe("1000");
      expect(stats.volume).toBeDefined();
    });
  });

  describe("HTTP Routes (Supertest)", () => {
    it("POST /api/admin/transactions/:id/reverse triggers reversal via endpoint", async () => {
      const entryId = crypto.randomUUID();
      mockDb.journalEntries.set(entryId, {
        id: entryId,
        type: "P2P",
        status: "COMPLETED",
        reference: "TXN-HTTP-REV",
      });
      mockDb.ledgerLines.push(
        { id: 1, entry_id: entryId, account_id: "acc-user1", direction: "DEBIT", amount: 5000n },
        { id: 2, entry_id: entryId, account_id: "acc-user2", direction: "CREDIT", amount: 5000n }
      );

      const res = await request(app)
        .post(`/api/admin/transactions/${entryId}/reverse`)
        .set("x-actor-id", "admin-http-1")
        .send({ reason: "Duplicate charge reported" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reversalEntry.type).toBe("REVERSAL");
    });

    it("PATCH /api/admin/accounts/:id/freeze and unfreeze work via HTTP", async () => {
      const freezeRes = await request(app)
        .patch("/api/admin/accounts/acc-user2/freeze")
        .send({ reason: "Court order" });

      expect(freezeRes.status).toBe(200);
      expect(freezeRes.body.data.status).toBe("FROZEN");

      const unfreezeRes = await request(app)
        .patch("/api/admin/accounts/acc-user2/unfreeze")
        .send({ reason: "Order resolved" });

      expect(unfreezeRes.status).toBe(200);
      expect(unfreezeRes.body.data.status).toBe("ACTIVE");
    });

    it("GET /api/admin/stats and GET /api/admin/reconciliation return reports via HTTP", async () => {
      const statsRes = await request(app).get("/api/admin/stats");
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.accounts.total).toBe(3);

      const runRes = await request(app).post("/api/admin/reconciliation/run");
      expect(runRes.status).toBe(200);
      expect(runRes.body.data.status).toBeDefined();

      const getRecRes = await request(app).get("/api/admin/reconciliation");
      expect(getRecRes.status).toBe(200);
      expect(getRecRes.body.data).toBeDefined();
    });

    it("GET /api/admin/audit-logs returns audit log entries via HTTP", async () => {
      await adminService.freezeAccount({ accountId: "acc-user1", actorId: "admin-audit-test" });

      const logsRes = await request(app).get("/api/admin/audit-logs");
      expect(logsRes.status).toBe(200);
      expect(logsRes.body.data.length).toBeGreaterThan(0);
      expect(logsRes.body.data[0].action).toBe("FREEZE_ACCOUNT");
    });
  });
});
