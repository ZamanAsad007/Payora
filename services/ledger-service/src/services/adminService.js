import { getPool } from "../db/pool.js";
import { NotFoundError } from "../utils/errors.js";

export class AdminService {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Freeze an account by ID or ownerId.
   */
  async freezeAccount({ accountId = null, ownerId = null, reason = "Risk flag freeze" }) {
    if (!accountId && !ownerId) {
      const err = new Error("accountId or ownerId is required to freeze account");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const client = await this.getDbPool().connect();
    try {
      let targetId = accountId;
      if (!targetId && ownerId) {
        const findRes = await client.query(
          "SELECT id FROM accounts WHERE owner_id = $1 AND type IN ('USER_WALLET', 'MERCHANT_WALLET') LIMIT 1",
          [ownerId]
        );
        if (findRes.rows.length === 0) {
          throw new NotFoundError(`No account found for ownerId: ${ownerId}`);
        }
        targetId = findRes.rows[0].id;
      }

      const res = await client.query(
        `UPDATE accounts
         SET status = 'FROZEN', updated_at = NOW()
         WHERE id = $1
         RETURNING id, owner_id, type, status, updated_at`,
        [targetId]
      );

      if (res.rows.length === 0) {
        throw new NotFoundError(`Account not found: ${targetId}`);
      }

      return {
        ...res.rows[0],
        reason,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Unfreeze an account by ID or ownerId.
   */
  async unfreezeAccount({ accountId = null, ownerId = null, reason = "Risk flag cleared" }) {
    if (!accountId && !ownerId) {
      const err = new Error("accountId or ownerId is required to unfreeze account");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const client = await this.getDbPool().connect();
    try {
      let targetId = accountId;
      if (!targetId && ownerId) {
        const findRes = await client.query(
          "SELECT id FROM accounts WHERE owner_id = $1 AND type IN ('USER_WALLET', 'MERCHANT_WALLET') LIMIT 1",
          [ownerId]
        );
        if (findRes.rows.length === 0) {
          throw new NotFoundError(`No account found for ownerId: ${ownerId}`);
        }
        targetId = findRes.rows[0].id;
      }

      const res = await client.query(
        `UPDATE accounts
         SET status = 'ACTIVE', updated_at = NOW()
         WHERE id = $1
         RETURNING id, owner_id, type, status, updated_at`,
        [targetId]
      );

      if (res.rows.length === 0) {
        throw new NotFoundError(`Account not found: ${targetId}`);
      }

      return {
        ...res.rows[0],
        reason,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Set user spending limits.
   */
  async setUserLimits({ userId, dailySendLimit, perTxnLimit, monthlyLimit }) {
    if (!userId) {
      const err = new Error("userId is required to configure limits");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const res = await this.getDbPool().query(
      `INSERT INTO limits (user_id, daily_send_limit, per_txn_limit, monthly_limit, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         daily_send_limit = EXCLUDED.daily_send_limit,
         per_txn_limit = EXCLUDED.per_txn_limit,
         monthly_limit = EXCLUDED.monthly_limit,
         updated_at = NOW()
       RETURNING user_id, daily_send_limit, per_txn_limit, monthly_limit, updated_at`,
      [
        userId,
        dailySendLimit ? dailySendLimit.toString() : "5000000",
        perTxnLimit ? perTxnLimit.toString() : "2500000",
        monthlyLimit ? monthlyLimit.toString() : "20000000",
      ]
    );

    return res.rows[0];
  }

  /**
   * Get user spending limits.
   */
  async getUserLimits(userId) {
    const res = await this.getDbPool().query("SELECT * FROM limits WHERE user_id = $1", [userId]);
    if (res.rows.length === 0) {
      return {
        userId,
        dailySendLimit: "5000000",
        perTxnLimit: "2500000",
        monthlyLimit: "20000000",
        isDefault: true,
      };
    }
    return {
      userId: res.rows[0].user_id,
      dailySendLimit: res.rows[0].daily_send_limit,
      perTxnLimit: res.rows[0].per_txn_limit,
      monthlyLimit: res.rows[0].monthly_limit,
      isDefault: false,
    };
  }
}
