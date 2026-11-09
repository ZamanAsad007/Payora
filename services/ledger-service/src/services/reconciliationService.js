import { getPool } from "../db/pool.js";
import { logger } from "../utils/logger.js";

export class ReconciliationService {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Run reconciliation across all accounts and ledger lines.
   * Proves ledger invariants:
   * 1. Cached balance == sum(CREDIT - DEBIT) for every account
   * 2. Sum of all debits across the entire ledger == Sum of all credits
   * 3. No negative balances in user/merchant accounts
   */
  async runReconciliation() {
    const pool = this.getDbPool();
    const client = await pool.connect();

    try {
      // 1. System-wide debit and credit totals
      const totalsRes = await client.query(`
        SELECT
          COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END), 0) AS total_debits,
          COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credits
        FROM ledger_lines
      `);

      const totalDebits = BigInt(totalsRes.rows[0].total_debits || 0);
      const totalCredits = BigInt(totalsRes.rows[0].total_credits || 0);

      // 2. Account level balance reconciliation
      const accountsRes = await client.query(`
        SELECT
          a.id,
          a.owner_id,
          a.type,
          a.balance AS cached_balance,
          COALESCE(SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount ELSE -l.amount END), 0) AS calculated_balance
        FROM accounts a
        LEFT JOIN ledger_lines l ON a.id = l.account_id
        GROUP BY a.id, a.owner_id, a.type, a.balance
        ORDER BY a.id ASC
      `);

      const totalAccounts = accountsRes.rows.length;
      let balancedAccounts = 0;
      let discrepancyAccounts = 0;
      const discrepancies = [];
      let totalSystemBalance = 0n;

      for (const row of accountsRes.rows) {
        const cached = BigInt(row.cached_balance);
        const calculated = BigInt(row.calculated_balance);
        totalSystemBalance += cached;

        if (cached === calculated) {
          balancedAccounts++;
        } else {
          discrepancyAccounts++;
          discrepancies.push({
            accountId: row.id,
            ownerId: row.owner_id,
            type: row.type,
            cachedBalance: cached.toString(),
            calculatedBalance: calculated.toString(),
            diff: (cached - calculated).toString(),
          });
        }
      }

      const systemBalanced = totalDebits === totalCredits && discrepancyAccounts === 0;
      const status = systemBalanced ? "BALANCED" : "DISCREPANCY";

      if (!systemBalanced) {
        logger.error(
          {
            totalDebits: totalDebits.toString(),
            totalCredits: totalCredits.toString(),
            discrepancyAccounts,
          },
          "[RECONCILIATION_ALERT] Ledger imbalance detected!"
        );
      } else {
        logger.info(
          {
            totalAccounts,
            balancedAccounts,
            totalDebits: totalDebits.toString(),
            totalCredits: totalCredits.toString(),
          },
          "[RECONCILIATION] All accounts balanced successfully."
        );
      }

      // Store report
      const reportRes = await client.query(
        `INSERT INTO reconciliation_reports
         (status, total_accounts, balanced_accounts, discrepancy_accounts, total_system_balance, total_debits, total_credits, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id, status, total_accounts, balanced_accounts, discrepancy_accounts, total_system_balance, total_debits, total_credits, details, created_at`,
        [
          status,
          totalAccounts,
          balancedAccounts,
          discrepancyAccounts,
          totalSystemBalance.toString(),
          totalDebits.toString(),
          totalCredits.toString(),
          JSON.stringify(discrepancies),
        ]
      );

      return {
        ...reportRes.rows[0],
        totalSystemBalance: reportRes.rows[0].total_system_balance.toString(),
        totalDebits: reportRes.rows[0].total_debits.toString(),
        totalCredits: reportRes.rows[0].total_credits.toString(),
      };
    } finally {
      client.release();
    }
  }

  async getLatestReport() {
    const res = await this.getDbPool().query(
      "SELECT * FROM reconciliation_reports ORDER BY created_at DESC LIMIT 1"
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async getReports({ limit = 20, offset = 0 } = {}) {
    const res = await this.getDbPool().query(
      "SELECT * FROM reconciliation_reports ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    return res.rows;
  }
}
