/**
 * Money utilities for Payora.
 *
 * SAFETY INVARIANT: Money is ALWAYS represented as integer minor units (poisha).
 * 1 Taka = 100 poisha.
 * Floats are NEVER used for monetary calculation or storage.
 */

export class Money {
  /**
   * Parse a Taka value (string or integer) into poisha (BigInt).
   * Parses decimals as strings directly to prevent IEEE 754 float precision loss.
   *
   * @param {string|number|bigint} val
   * @returns {bigint} amount in poisha
   */
  static toPoisha(val) {
    if (typeof val === "bigint") {
      if (val < 0n) throw new RangeError("Money amount cannot be negative");
      return val;
    }

    if (val === null || val === undefined) {
      throw new TypeError("Money amount cannot be null or undefined");
    }

    const str = String(val).trim();
    if (str === "") {
      throw new TypeError("Money amount cannot be empty");
    }

    // Must be positive number with at most 2 decimal places
    const match = /^(?<taka>\d+)(?:\.(?<poisha>\d{1,2}))?$/.exec(str);
    if (!match || !match.groups) {
      throw new RangeError(`Invalid monetary format: "${str}". Must be non-negative with up to 2 decimal places.`);
    }

    const takaPart = BigInt(match.groups.taka);
    const poishaRaw = match.groups.poisha || "";
    // Pad poisha: "5" -> 50 poisha, "05" -> 5 poisha, "" -> 0 poisha
    const poishaPart = BigInt(poishaRaw.padEnd(2, "0"));

    return takaPart * 100n + poishaPart;
  }

  /**
   * Convert poisha (BigInt or integer) to decimal Taka string (e.g. "100.50").
   *
   * @param {bigint|number} poisha
   * @returns {string}
   */
  static toTaka(poisha) {
    const val = BigInt(poisha);
    const isNegative = val < 0n;
    const absVal = isNegative ? -val : val;

    const taka = absVal / 100n;
    const remainder = absVal % 100n;
    const poishaStr = remainder.toString().padStart(2, "0");

    const result = `${taka}.${poishaStr}`;
    return isNegative ? `-${result}` : result;
  }

  /**
   * Format poisha into human-readable currency representation (e.g. "৳ 1,250.50").
   *
   * @param {bigint|number} poisha
   * @param {object} [options]
   * @returns {string}
   */
  static format(poisha, { symbol = true, currency = "BDT" } = {}) {
    const takaStr = this.toTaka(poisha);
    const [takaPart, poishaPart] = takaStr.split(".");

    // Add thousands commas to takaPart
    const withCommas = takaPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const formattedAmount = `${withCommas}.${poishaPart}`;

    if (symbol) {
      return `৳ ${formattedAmount}`;
    }
    return `${formattedAmount} ${currency}`;
  }

  static add(a, b) {
    return BigInt(a) + BigInt(b);
  }

  static subtract(a, b) {
    const diff = BigInt(a) - BigInt(b);
    if (diff < 0n) {
      throw new RangeError("Subtraction would result in negative poisha");
    }
    return diff;
  }

  static multiply(poisha, factor) {
    return BigInt(poisha) * BigInt(factor);
  }

  static divide(poisha, divisor) {
    const d = BigInt(divisor);
    if (d === 0n) throw new RangeError("Division by zero");
    return BigInt(poisha) / d;
  }

  static isZero(poisha) {
    return BigInt(poisha) === 0n;
  }

  static isPositive(poisha) {
    return BigInt(poisha) > 0n;
  }

  static compare(a, b) {
    const bigA = BigInt(a);
    const bigB = BigInt(b);
    if (bigA < bigB) return -1;
    if (bigA > bigB) return 1;
    return 0;
  }
}
