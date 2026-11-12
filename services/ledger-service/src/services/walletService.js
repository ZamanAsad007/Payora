import { getPool } from "../db/pool.js";
import { Money } from "../domain/money.js";
import { NotFoundError } from "../utils/errors.js";

export class WalletService {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Fetch current wallet balance and status.
   */
  async getBalance({ userId, customClient = null }) {
    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      const res = await client.query(
        "SELECT id, balance, currency, status FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [userId]
      );

      if (res.rows.length === 0) {
        throw new NotFoundError("Wallet account not found for user");
      }

      const row = res.rows[0];
      const balancePoisha = BigInt(row.balance);

      return {
        accountId: row.id,
        balancePoisha: balancePoisha.toString(),
        balanceTaka: Money.toTaka(balancePoisha),
        formatted: Money.format(balancePoisha),
        currency: row.currency,
        status: row.status,
      };
    } finally {
      if (shouldRelease) client.release();
    }
  }

  /**
   * Fetch transaction history with cursor-based pagination.
   */
  async getTransactions({
    userId,
    cursor = null,
    limit = 20,
    type = null,
    customClient = null,
  }) {
    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      // Find user account
      const accRes = await client.query(
        "SELECT id FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [userId]
      );
      if (accRes.rows.length === 0) {
        throw new NotFoundError("Wallet account not found");
      }
      const accountId = accRes.rows[0].id;

      let sql = `
        SELECT
          j.id as entry_id,
          j.type,
          j.status,
          j.reference,
          j.description,
          j.created_at,
          l.direction,
          l.amount
        FROM ledger_lines l
        JOIN journal_entries j ON j.id = l.entry_id
        WHERE l.account_id = $1
      `;
      const params = [accountId];

      if (type) {
        params.push(type);
        sql += ` AND j.type = $${params.length}`;
      }

      if (cursor) {
        params.push(new Date(cursor));
        sql += ` AND j.created_at < $${params.length}`;
      }

      const clampedLimit = Math.min(limit, 50);
      params.push(clampedLimit);
      sql += ` ORDER BY j.created_at DESC LIMIT $${params.length}`;

      const res = await client.query(sql, params);

      const items = res.rows.map((r) => ({
        id: r.entry_id,
        type: r.type,
        status: r.status,
        reference: r.reference,
        description: r.description,
        direction: r.direction,
        amountPoisha: r.amount.toString(),
        amountTaka: Money.toTaka(BigInt(r.amount)),
        createdAt: r.created_at,
      }));

      const hasMore = items.length === clampedLimit;
      const nextCursor = hasMore ? items[items.length - 1].createdAt : null;

      return {
        items,
        nextCursor,
        hasMore,
      };
    } finally {
      if (shouldRelease) client.release();
    }
  }
}
