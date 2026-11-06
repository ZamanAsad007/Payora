/**
 * LimitChecker: Enforces per-transaction, daily, and monthly transaction limits.
 */
export class LimitChecker {
  /**
   * Validate a proposed transaction against user limits.
   *
   * @param {object} params
   * @param {bigint|number} params.amountPoisha
   * @param {object} params.limits
   * @param {bigint|number} [params.limits.perTxnLimit]
   * @param {bigint|number} [params.limits.dailySendLimit]
   * @param {bigint|number} [params.limits.monthlyLimit]
   * @param {bigint|number} [params.currentDailyTotal=0n]
   * @param {bigint|number} [params.currentMonthlyTotal=0n]
   */
  static checkLimits({
    amountPoisha,
    limits = {},
    currentDailyTotal = 0n,
    currentMonthlyTotal = 0n,
  }) {
    const amount = BigInt(amountPoisha);
    if (amount <= 0n) {
      throw new Error("Transaction amount must be positive");
    }

    // Default system limits if not set per user:
    // Per-txn: 25,000 Taka (2,500,000 poisha)
    // Daily: 50,000 Taka (5,000,000 poisha)
    // Monthly: 200,000 Taka (20,000,000 poisha)
    const perTxnLimit = limits.perTxnLimit ? BigInt(limits.perTxnLimit) : 2500000n;
    const dailyLimit = limits.dailySendLimit ? BigInt(limits.dailySendLimit) : 5000000n;
    const monthlyLimit = limits.monthlyLimit ? BigInt(limits.monthlyLimit) : 20000000n;

    if (amount > perTxnLimit) {
      const err = new Error(
        `Amount exceeds maximum per-transaction limit of ${(perTxnLimit / 100n).toString()} Taka`
      );
      err.code = "LIMIT_EXCEEDED";
      err.statusCode = 422;
      err.details = { limitType: "PER_TRANSACTION", limit: perTxnLimit.toString(), amount: amount.toString() };
      throw err;
    }

    const proposedDaily = BigInt(currentDailyTotal) + amount;
    if (proposedDaily > dailyLimit) {
      const err = new Error(
        `Transaction would exceed daily limit of ${(dailyLimit / 100n).toString()} Taka`
      );
      err.code = "LIMIT_EXCEEDED";
      err.statusCode = 422;
      err.details = { limitType: "DAILY", limit: dailyLimit.toString(), currentDaily: currentDailyTotal.toString(), amount: amount.toString() };
      throw err;
    }

    const proposedMonthly = BigInt(currentMonthlyTotal) + amount;
    if (proposedMonthly > monthlyLimit) {
      const err = new Error(
        `Transaction would exceed monthly limit of ${(monthlyLimit / 100n).toString()} Taka`
      );
      err.code = "LIMIT_EXCEEDED";
      err.statusCode = 422;
      err.details = { limitType: "MONTHLY", limit: monthlyLimit.toString(), currentMonthly: currentMonthlyTotal.toString(), amount: amount.toString() };
      throw err;
    }

    return true;
  }
}
