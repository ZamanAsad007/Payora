import { describe, it, expect, beforeEach } from "@jest/globals";
import { LedgerRepository } from "../../src/repositories/ledgerRepository.js";
import { EntryBuilder } from "../../src/domain/entryBuilder.js";

function createMockDb() {
  const accounts = new Map([
    ["acc-user-1", { id: "acc-user-1", type: "USER_WALLET", balance: 50000n, status: "ACTIVE" }],
    ["acc-user-2", { id: "acc-user-2", type: "USER_WALLET", balance: 10000n, status: "ACTIVE" }],
    ["acc-bank", { id: "acc-bank", type: "SYSTEM_BANK_CLEARING", balance: 0n, status: "ACTIVE" }],
    ["acc-frozen", { id: "acc-frozen", type: "USER_WALLET", balance: 50000n, status: "FROZEN" }],
  ]);

  const journalEntries = new Map();
  const ledgerLines = [];

  const mockClient = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
        return { rows: [] };
      }

      // SELECT accounts FOR UPDATE
      if (s.startsWith("SELECT") && s.includes("FROM accounts") && s.includes("FOR UPDATE")) {
        const ids = params[0];
        const rows = ids
          .map((id) => accounts.get(id))
          .filter(Boolean)
          .map((acc) => ({ ...acc, balance: acc.balance.toString() }));
        return { rows };
      }

      // INSERT INTO journal_entries
      if (s.startsWith("INSERT INTO journal_entries")) {
        const entry = {
          id: params[0],
          type: params[1],
          status: params[2],
          reference: params[3],
          description: params[4],
          reverses_entry_id: params[5],
          created_at: new Date(),
        };
        journalEntries.set(params[0], entry);
        return { rows: [entry] };
      }

      // INSERT INTO ledger_lines
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

      // UPDATE accounts balance
      if (s.startsWith("UPDATE accounts") && s.includes("SET balance = balance + $1")) {
        const delta = BigInt(params[0]);
        const accId = params[1];
        const acc = accounts.get(accId);
        if (acc) {
          acc.balance += delta;
        }
        return { rowCount: 1 };
      }

      return { rows: [] };
    },
  };

  return { accounts, mockClient };
}

describe("LedgerRepository Unit Tests", () => {
  let repo;
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new LedgerRepository();
  });

  it("posts balanced entry and updates cached account balances", async () => {
    const { entry, lines } = EntryBuilder.buildP2PEntry({
      senderAccountId: "acc-user-1",
      receiverAccountId: "acc-user-2",
      amountPoisha: 20000n, // 200 Taka
      feePoisha: 0n,
      reference: "ref-test-p2p",
    });

    const res = await repo.postEntry({
      entry,
      lines,
      customClient: mockDb.mockClient,
    });

    expect(res.entry.id).toBe(entry.id);
    expect(res.lines).toHaveLength(2);

    // Verify balance changes
    expect(mockDb.accounts.get("acc-user-1").balance).toBe(30000n); // 50000 - 20000
    expect(mockDb.accounts.get("acc-user-2").balance).toBe(30000n); // 10000 + 20000
  });

  it("rejects entry when sender has insufficient funds", async () => {
    const { entry, lines } = EntryBuilder.buildP2PEntry({
      senderAccountId: "acc-user-1",
      receiverAccountId: "acc-user-2",
      amountPoisha: 100000n, // Exceeds balance of 50000n
      reference: "ref-fail-overdraft",
    });

    await expect(
      repo.postEntry({
        entry,
        lines,
        customClient: mockDb.mockClient,
      })
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
  });

  it("rejects entry if any participant account is frozen", async () => {
    const { entry, lines } = EntryBuilder.buildP2PEntry({
      senderAccountId: "acc-frozen",
      receiverAccountId: "acc-user-2",
      amountPoisha: 5000n,
      reference: "ref-frozen",
    });

    await expect(
      repo.postEntry({
        entry,
        lines,
        customClient: mockDb.mockClient,
      })
    ).rejects.toMatchObject({
      code: "ACCOUNT_FROZEN",
    });
  });
});
