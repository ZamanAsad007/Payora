import { getPool } from "../db/pool.js";
import { InsufficientFundsError, AccountFrozenError, NotFoundError } from "../utils/errors.js";

export class LedgerRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Post a balanced journal entry and its ledger lines inside an atomic transaction
   * with deterministic row locks (ORDER BY id ASC FOR UPDATE) to prevent deadlocks.
   *
   * @param {object} params
   * @param {object} params.entry - Journal entry metadata
   * @param {Array<object>} params.lines - Balanced debit & credit ledger lines
   * @param {object} [params.customClient] - Optional injected db client for testing
   * @returns {Promise<object>} posted entry and lines
   */
  async postEntry({ entry, lines, customClient = null }) {
    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      if (!customClient) {
        await client.query("BEGIN");
      }

      // 1. Collect all distinct account IDs affected by this entry
      const accountIds = Array.from(new Set(lines.map((l) => l.accountId))).sort();

      // 2. Deterministic row-level locking: always lock accounts in ascending ID order
      const lockRes = await client.query(
        `SELECT id, type, balance, status
         FROM accounts
         WHERE id = ANY($1::uuid[])
         ORDER BY id ASC
         FOR UPDATE`,
        [accountIds]
      );

      const accountsMap = new Map();
      for (const row of lockRes.rows) {
        accountsMap.set(row.id, {
          ...row,
          balance: BigInt(row.balance),
        });
      }

      // 3. Verify all affected accounts exist
      for (const id of accountIds) {
        if (!accountsMap.has(id)) {
          throw new NotFoundError(`Account not found: ${id}`);
        }
      }

      // 4. Validate accounts are active and have sufficient balance for debits
      const balanceDeltas = new Map(); // accountId -> net delta (credit - debit)

      for (const line of lines) {
        const acc = accountsMap.get(line.accountId);
        if (acc.status === "FROZEN") {
          throw new AccountFrozenError(`Account ${line.accountId} is frozen`);
        }
        if (acc.status !== "ACTIVE") {
          throw new Error(`Account ${line.accountId} is not active (status: ${acc.status})`);
        }

        const delta = balanceDeltas.get(line.accountId) || 0n;
        if (line.direction === "DEBIT") {
          balanceDeltas.set(line.accountId, delta - BigInt(line.amount));
        } else {
          balanceDeltas.set(line.accountId, delta + BigInt(line.amount));
        }
      }

      // Check balance constraints (no negative user/merchant balances)
      for (const [accId, delta] of balanceDeltas.entries()) {
        const acc = accountsMap.get(accId);
        const newBalance = acc.balance + delta;

        if (["USER_WALLET", "MERCHANT_WALLET"].includes(acc.type) && newBalance < 0n) {
          throw new InsufficientFundsError(
            `Insufficient funds in account ${accId}. Balance: ${acc.balance}, Required debit: ${-delta}`
          );
        }
      }

      // 5. Insert journal entry
      const insertEntrySql = `
        INSERT INTO journal_entries (id, type, status, reference, description, reverses_entry_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, type, status, reference, description, reverses_entry_id, created_at
      `;
      const entryRes = await client.query(insertEntrySql, [
        entry.id,
        entry.type,
        entry.status || "COMPLETED",
        entry.reference,
        entry.description || null,
        entry.reversesEntryId || null,
      ]);

      // 6. Insert ledger lines
      const insertedLines = [];
      for (const line of lines) {
        const lineRes = await client.query(
          `INSERT INTO ledger_lines (entry_id, account_id, direction, amount)
           VALUES ($1, $2, $3, $4)
           RETURNING id, entry_id, account_id, direction, amount, created_at`,
          [entry.id, line.accountId, line.direction, line.amount.toString()]
        );
        insertedLines.push({
          ...lineRes.rows[0],
          amount: BigInt(lineRes.rows[0].amount),
        });
      }

      // 7. Update cached account balances
      for (const [accId, delta] of balanceDeltas.entries()) {
        await client.query(
          `UPDATE accounts
           SET balance = balance + $1, version = version + 1, updated_at = NOW()
           WHERE id = $2`,
          [delta.toString(), accId]
        );
      }

      if (!customClient) {
        await client.query("COMMIT");
      }

      return {
        entry: entryRes.rows[0],
        lines: insertedLines,
      };
    } catch (err) {
      if (!customClient) {
        await client.query("ROLLBACK");
      }
      throw err;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }

  /**
   * Fetch account by ID
   */
  async getAccountById(accountId, client = null) {
    const q = client ? client.query.bind(client) : this.getDbPool().query.bind(this.getDbPool());
    const res = await q("SELECT * FROM accounts WHERE id = $1", [accountId]);
    if (res.rows.length === 0) return null;
    return {
      ...res.rows[0],
      balance: BigInt(res.rows[0].balance),
    };
  }
}
