import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { StatementService } from "../../src/services/statementService.js";
import { createApp } from "../../src/app.js";

function createMockDb() {
  const accounts = new Map([
    ["user-1", { id: "acc-user1", owner_id: "user-1", type: "USER_WALLET", balance: 75000n, currency: "BDT" }],
  ]);

  const ledgerLines = [
    // Pre-period line (for opening balance)
    {
      id: 1,
      entry_id: "entry-0",
      account_id: "acc-user1",
      direction: "CREDIT",
      amount: "50000", // 500.00 BDT
      created_at: new Date("2026-01-01T10:00:00Z"),
      type: "TOP_UP",
      reference: "ref-topup-0",
      description: "Initial Top Up",
    },
    // In-period lines
    {
      id: 2,
      entry_id: "entry-1",
      account_id: "acc-user1",
      direction: "DEBIT",
      amount: "15000", // 150.00 BDT
      created_at: new Date("2026-01-15T12:00:00Z"),
      type: "P2P",
      reference: "ref-p2p-1",
      description: "Transfer to friend",
    },
    {
      id: 3,
      entry_id: "entry-2",
      account_id: "acc-user1",
      direction: "CREDIT",
      amount: "40000", // 400.00 BDT
      created_at: new Date("2026-01-20T15:30:00Z"),
      type: "TOP_UP",
      reference: "ref-topup-2",
      description: "Salary Top Up",
    },
  ];

  const mockClient = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      // Account lookup
      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'")) {
        const acc = accounts.get(params[0]);
        return { rows: acc ? [acc] : [] };
      }

      // Opening balance
      if (s.startsWith("SELECT") && s.includes("opening_balance") && s.includes("WHERE account_id = $1 AND created_at < $2")) {
        const accId = params[0];
        const dateThreshold = new Date(params[1]);

        let sum = 0n;
        for (const line of ledgerLines) {
          if (line.account_id === accId && line.created_at < dateThreshold) {
            sum += line.direction === "CREDIT" ? BigInt(line.amount) : -BigInt(line.amount);
          }
        }
        return { rows: [{ opening_balance: sum.toString() }] };
      }

      // In-period lines
      if (s.startsWith("SELECT") && s.includes("FROM ledger_lines l") && s.includes("created_at >= $2 AND l.created_at <= $3")) {
        const accId = params[0];
        const fromDate = new Date(params[1]);
        const toDate = new Date(params[2]);

        const filtered = ledgerLines.filter(
          (l) => l.account_id === accId && l.created_at >= fromDate && l.created_at <= toDate
        );
        return { rows: filtered };
      }

      return { rows: [] };
    },
    release: () => {},
  };

  const pool = {
    connect: async () => mockClient,
    query: async (sql, params) => mockClient.query(sql, params),
  };

  return { pool, mockClient, accounts, ledgerLines };
}

describe("Phase 8: Statements Export (CSV and PDF)", () => {
  let mockDb;
  let statementService;

  beforeEach(() => {
    mockDb = createMockDb();
    statementService = new StatementService(mockDb.pool);
  });

  describe("Statement calculation & running balance", () => {
    it("computes accurate opening balance, running balances, and closing balance", async () => {
      const data = await statementService.getStatementData({
        userId: "user-1",
        from: "2026-01-10T00:00:00Z",
        to: "2026-01-30T00:00:00Z",
      });

      expect(data.openingBalanceTaka).toBe("500.00");
      expect(data.items.length).toBe(2);

      // Line 1: Debit 150.00 -> Balance becomes 350.00
      expect(data.items[0].debitTaka).toBe("150.00");
      expect(data.items[0].runningBalanceTaka).toBe("350.00");

      // Line 2: Credit 400.00 -> Balance becomes 750.00
      expect(data.items[1].creditTaka).toBe("400.00");
      expect(data.items[1].runningBalanceTaka).toBe("750.00");

      expect(data.closingBalanceTaka).toBe("750.00");
    });
  });

  describe("CSV Export", () => {
    it("generates formatted CSV with headers and transactions", async () => {
      const data = await statementService.getStatementData({
        userId: "user-1",
        from: "2026-01-10T00:00:00Z",
        to: "2026-01-30T00:00:00Z",
      });

      const csv = await statementService.exportCsv(data);
      expect(csv).toContain("Date,Reference,Type,Description,Debit (BDT),Credit (BDT),Running Balance (BDT)");
      expect(csv).toContain("OPENING_BALANCE");
      expect(csv).toContain("ref-p2p-1");
      expect(csv).toContain("150.00");
      expect(csv).toContain("750.00");
    });
  });

  describe("PDF Export", () => {
    it("generates a valid binary PDF buffer", async () => {
      const data = await statementService.getStatementData({
        userId: "user-1",
        from: "2026-01-10T00:00:00Z",
        to: "2026-01-30T00:00:00Z",
      });

      const pdfBuffer = await statementService.exportPdf(data);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(100);
      // PDF header magic bytes "%PDF-"
      expect(pdfBuffer.toString("utf-8", 0, 5)).toBe("%PDF-");
    });
  });

  describe("HTTP Routes (Supertest)", () => {
    it("GET /api/statements?format=csv returns CSV file download", async () => {
      const app = createApp({ statementService });

      const res = await request(app)
        .get("/api/statements?format=csv&from=2026-01-10T00:00:00Z&to=2026-01-30T00:00:00Z")
        .set("x-user-id", "user-1");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.text).toContain("Running Balance (BDT)");
    });

    it("GET /api/statements?format=pdf returns PDF document download", async () => {
      const app = createApp({ statementService });

      const res = await request(app)
        .get("/api/statements?format=pdf&from=2026-01-10T00:00:00Z&to=2026-01-30T00:00:00Z")
        .set("x-user-id", "user-1");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.body.toString("utf-8", 0, 5)).toBe("%PDF-");
    });

    it("GET /api/statements?format=json returns structured statement data", async () => {
      const app = createApp({ statementService });

      const res = await request(app)
        .get("/api/statements?format=json&from=2026-01-10T00:00:00Z&to=2026-01-30T00:00:00Z")
        .set("x-user-id", "user-1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.openingBalanceTaka).toBe("500.00");
      expect(res.body.data.closingBalanceTaka).toBe("750.00");
    });
  });
});
