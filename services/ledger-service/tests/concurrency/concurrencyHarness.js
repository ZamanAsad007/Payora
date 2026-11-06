import crypto from "node:crypto";
import { LedgerRepository } from "../../src/repositories/ledgerRepository.js";
import { TransferService } from "../../src/services/transferService.js";

/**
 * Creates a concurrency-safe in-memory database simulation
 * that mimics PostgreSQL row-level locks (FOR UPDATE with ORDER BY id ASC)
 * and atomic transactions.
 */
export function createConcurrencyDb({
  initialAccounts = [],
}) {
  const accounts = new Map();
  for (const acc of initialAccounts) {
    accounts.set(acc.id, {
      ...acc,
      balance: BigInt(acc.balance),
      version: 1,
    });
  }

  // Account mutexes for row-level locks
  const accountLocks = new Map();
  for (const id of accounts.keys()) {
    accountLocks.set(id, null);
  }

  const idempotencyKeys = new Map();
  const idempotencyLocks = new Map();
  const journalEntries = new Map();
  const ledgerLines = [];

  // Helper to acquire a lock
  async function acquireLock(lockMap, key) {
    while (lockMap.get(key)) {
      await lockMap.get(key);
    }
    let resolveLock;
    const promise = new Promise((resolve) => {
      resolveLock = resolve;
    });
    lockMap.set(key, promise);
    return () => {
      lockMap.set(key, null);
      resolveLock();
    };
  }

  class SimulatedClient {
    constructor() {
      this.heldLocks = [];
      this.inTransaction = false;
    }

    async query(sql, params = []) {
      const s = sql.trim();

      if (s === "BEGIN") {
        this.inTransaction = true;
        return { rows: [] };
      }

      if (s === "COMMIT" || s === "ROLLBACK") {
        this.inTransaction = false;
        // Release held row locks
        while (this.heldLocks.length > 0) {
          const unlock = this.heldLocks.pop();
          unlock();
        }
        return { rows: [] };
      }

      // SELECT accounts FOR UPDATE
      if (s.startsWith("SELECT") && s.includes("FROM accounts") && s.includes("FOR UPDATE")) {
        const ids = params[0];
        // Always acquire locks in ascending order to prevent deadlocks
        const sortedIds = [...ids].sort();

        for (const id of sortedIds) {
          if (!accountLocks.has(id)) {
            accountLocks.set(id, null);
          }
          const unlock = await acquireLock(accountLocks, id);
          this.heldLocks.push(unlock);
        }

        // Add micro-jitter to stress race conditions
        await new Promise((r) => setTimeout(r, Math.random() * 2));

        const rows = sortedIds
          .map((id) => accounts.get(id))
          .filter(Boolean)
          .map((a) => ({ ...a, balance: a.balance.toString() }));

        return { rows };
      }

      // SELECT idempotency_keys FOR UPDATE
      if (s.startsWith("SELECT") && s.includes("FROM idempotency_keys") && s.includes("FOR UPDATE")) {
        const lockKey = `${params[0]}-${params[1]}`;
        const unlock = await acquireLock(idempotencyLocks, lockKey);
        this.heldLocks.push(unlock);

        const rec = idempotencyKeys.get(lockKey);
        return { rows: rec ? [rec] : [] };
      }

      // INSERT idempotency_keys
      if (s.startsWith("INSERT INTO idempotency_keys")) {
        const key = `${params[0]}-${params[1]}`;
        const rec = {
          key: params[0],
          user_id: params[1],
          request_hash: params[2],
          response: typeof params[3] === "string" ? JSON.parse(params[3]) : params[3],
          status_code: params[4],
        };
        idempotencyKeys.set(key, rec);
        return { rows: [rec] };
      }

      // Account lookup for sender / receiver
      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'")) {
        const acc = Array.from(accounts.values()).find(
          (a) => (a.owner_id === params[0] || a.id === params[0]) && a.type === "USER_WALLET"
        );
        return { rows: acc ? [{ ...acc, balance: acc.balance.toString() }] : [] };
      }

      if (s.startsWith("SELECT") && s.includes("FROM accounts WHERE type = 'SYSTEM_FEE_REVENUE'")) {
        const feeAcc = Array.from(accounts.values()).find((a) => a.type === "SYSTEM_FEE_REVENUE");
        return { rows: feeAcc ? [{ id: feeAcc.id }] : [] };
      }

      // INSERT journal_entries
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

      // INSERT ledger_lines
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
          acc.version += 1;
        }
        return { rowCount: 1 };
      }

      return { rows: [] };
    }

    release() {
      while (this.heldLocks.length > 0) {
        const unlock = this.heldLocks.pop();
        unlock();
      }
    }
  }

  const pool = {
    connect: async () => new SimulatedClient(),
  };

  const ledgerRepo = new LedgerRepository(pool);
  const transferService = new TransferService(ledgerRepo, pool);

  return {
    accounts,
    journalEntries,
    ledgerLines,
    idempotencyKeys,
    pool,
    ledgerRepo,
    transferService,
  };
}
