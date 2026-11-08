import { getPool } from "../db/pool.js";
import { NotFoundError } from "../utils/errors.js";

export class PayeeService {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * List saved payees for a user.
   *
   * @param {object} params
   * @param {string} params.userId
   */
  async listPayees({ userId }) {
    if (!userId) {
      throw new Error("userId is required to list payees");
    }

    const res = await this.getDbPool().query(
      `SELECT p.id, p.user_id, p.payee_account_id, p.nickname, p.first_used_at, p.created_at,
              a.owner_id as payee_user_id, a.type as account_type, a.status as account_status
       FROM payees p
       JOIN accounts a ON a.id = p.payee_account_id
       WHERE p.user_id = $1
       ORDER BY p.first_used_at DESC`,
      [userId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      payeeAccountId: row.payee_account_id,
      payeeUserId: row.payee_user_id,
      nickname: row.nickname,
      firstUsedAt: row.first_used_at,
      createdAt: row.created_at,
      accountStatus: row.account_status,
    }));
  }

  /**
   * Add or update a saved payee.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} [params.payeeAccountId]
   * @param {string} [params.payeePhone]
   * @param {string} params.nickname
   */
  async addPayee({ userId, payeeAccountId, payeePhone, nickname }) {
    if (!userId) {
      const err = new Error("userId is required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }
    if (!nickname || nickname.trim().length === 0) {
      const err = new Error("nickname is required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const client = await this.getDbPool().connect();
    try {
      let targetAccountId = payeeAccountId;

      // If phone provided, resolve account by phone
      if (!targetAccountId && payeePhone) {
        const phoneRes = await client.query(
          `SELECT a.id, a.owner_id
           FROM accounts a
           JOIN users u ON u.id = a.owner_id
           WHERE u.phone = $1 AND a.type = 'USER_WALLET'`,
          [payeePhone]
        );
        if (phoneRes.rows.length === 0) {
          throw new NotFoundError(`No wallet found for phone: ${payeePhone}`);
        }
        targetAccountId = phoneRes.rows[0].id;
      }

      if (!targetAccountId) {
        const err = new Error("payeeAccountId or payeePhone is required");
        err.code = "VALIDATION_ERROR";
        err.statusCode = 400;
        throw err;
      }

      // Check account exists
      const accRes = await client.query("SELECT id, owner_id FROM accounts WHERE id = $1", [
        targetAccountId,
      ]);
      if (accRes.rows.length === 0) {
        throw new NotFoundError(`Payee account not found: ${targetAccountId}`);
      }

      if (accRes.rows[0].owner_id && accRes.rows[0].owner_id === userId) {
        const err = new Error("Cannot add your own account as a payee");
        err.code = "SELF_PAYEE_NOT_ALLOWED";
        err.statusCode = 400;
        throw err;
      }

      // Insert or update payee
      const res = await client.query(
        `INSERT INTO payees (user_id, payee_account_id, nickname)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, payee_account_id)
         DO UPDATE SET nickname = EXCLUDED.nickname
         RETURNING id, user_id, payee_account_id, nickname, first_used_at, created_at`,
        [userId, targetAccountId, nickname.trim()]
      );

      return res.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Delete a saved payee.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.payeeId
   */
  async deletePayee({ userId, payeeId }) {
    if (!userId || !payeeId) {
      const err = new Error("userId and payeeId are required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const res = await this.getDbPool().query(
      "DELETE FROM payees WHERE id = $1 AND user_id = $2 RETURNING id",
      [payeeId, userId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError(`Payee not found: ${payeeId}`);
    }

    return { deleted: true, payeeId };
  }
}
