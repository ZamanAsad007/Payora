/**
 * FeeCalculator: Pure integer poisha math for transaction fees.
 * Never uses floating point math; rounded deterministically.
 */
export class FeeCalculator {
  /**
   * Calculate fee based on basis points (1 bp = 0.01%) and optional flat fee with caps.
   *
   * @param {bigint|number} amountPoisha
   * @param {object} rule
   * @param {number} [rule.basisPoints=0] e.g. 185 for 1.85%
   * @param {bigint|number} [rule.flatPoisha=0n]
   * @param {bigint|number} [rule.minFeePoisha=0n]
   * @param {bigint|number} [rule.maxFeePoisha=null]
   * @returns {bigint} calculated fee in poisha
   */
  static calculate(amountPoisha, rule = {}) {
    const amount = BigInt(amountPoisha);
    if (amount <= 0n) return 0n;

    const basisPoints = BigInt(rule.basisPoints || 0);
    const flatPoisha = BigInt(rule.flatPoisha || 0n);
    const minFee = BigInt(rule.minFeePoisha || 0n);
    const maxFee = rule.maxFeePoisha !== undefined && rule.maxFeePoisha !== null
      ? BigInt(rule.maxFeePoisha)
      : null;

    // Basis points integer calculation: (amount * bps) / 10000
    const percentagePart = (amount * basisPoints) / 10000n;
    let totalFee = flatPoisha + percentagePart;

    if (totalFee < minFee) {
      totalFee = minFee;
    }

    if (maxFee !== null && totalFee > maxFee) {
      totalFee = maxFee;
    }

    return totalFee;
  }

  /**
   * Default P2P transfer fee:
   * Free under 100 Taka (10000 poisha), otherwise 5 Taka (500 poisha) flat.
   */
  static calculateP2PFee(amountPoisha) {
    const amount = BigInt(amountPoisha);
    if (amount < 10000n) {
      return 0n;
    }
    return 500n; // 5.00 Taka
  }

  /**
   * Default Cash-Out fee:
   * 1.85% (185 basis points), minimum 10 Taka (1000 poisha).
   */
  static calculateCashOutFee(amountPoisha) {
    return this.calculate(amountPoisha, {
      basisPoints: 185,
      flatPoisha: 0n,
      minFeePoisha: 1000n, // 10.00 Taka minimum
    });
  }

  /**
   * Default Merchant payment fee:
   * 1.00% (100 basis points) flat, capped at 50 Taka (5000 poisha).
   */
  static calculateMerchantFee(amountPoisha) {
    return this.calculate(amountPoisha, {
      basisPoints: 100,
      flatPoisha: 0n,
      minFeePoisha: 0n,
      maxFeePoisha: 5000n,
    });
  }
}
