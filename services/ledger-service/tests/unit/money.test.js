import { describe, it, expect } from "@jest/globals";
import { Money } from "../../src/domain/money.js";

describe("Money Domain Helper", () => {
  describe("toPoisha", () => {
    it("converts whole taka amounts correctly", () => {
      expect(Money.toPoisha("100")).toBe(10000n);
      expect(Money.toPoisha(100)).toBe(10000n);
      expect(Money.toPoisha("0")).toBe(0n);
      expect(Money.toPoisha(0)).toBe(0n);
    });

    it("converts decimal taka amounts correctly without float rounding errors", () => {
      // Classic float rounding bug: 19.99 * 100 in JS float is 1998.9999999999998
      expect(Money.toPoisha("19.99")).toBe(1999n);
      expect(Money.toPoisha("100.50")).toBe(10050n);
      expect(Money.toPoisha("100.5")).toBe(10050n);
      expect(Money.toPoisha("0.05")).toBe(5n);
      expect(Money.toPoisha("0.01")).toBe(1n);
      expect(Money.toPoisha("0.99")).toBe(99n);
    });

    it("handles large amounts safely using BigInt", () => {
      expect(Money.toPoisha("1000000000.75")).toBe(100000000075n);
    });

    it("trims whitespace", () => {
      expect(Money.toPoisha("  250.25  ")).toBe(25025n);
    });

    it("passes through valid BigInt values", () => {
      expect(Money.toPoisha(5000n)).toBe(5000n);
    });

    it("throws RangeError on negative amounts", () => {
      expect(() => Money.toPoisha("-50.00")).toThrow(RangeError);
      expect(() => Money.toPoisha(-50n)).toThrow(RangeError);
    });

    it("throws RangeError on more than 2 decimal places", () => {
      expect(() => Money.toPoisha("10.999")).toThrow(RangeError);
      expect(() => Money.toPoisha("0.001")).toThrow(RangeError);
    });

    it("throws on invalid non-numeric inputs", () => {
      expect(() => Money.toPoisha("abc")).toThrow(RangeError);
      expect(() => Money.toPoisha("")).toThrow(TypeError);
      expect(() => Money.toPoisha(null)).toThrow(TypeError);
      expect(() => Money.toPoisha(undefined)).toThrow(TypeError);
    });
  });

  describe("toTaka", () => {
    it("converts poisha to two-decimal Taka string", () => {
      expect(Money.toTaka(10050n)).toBe("100.50");
      expect(Money.toTaka(5n)).toBe("0.05");
      expect(Money.toTaka(0n)).toBe("0.00");
      expect(Money.toTaka(10000n)).toBe("100.00");
      expect(Money.toTaka(99n)).toBe("0.99");
    });

    it("handles negative values if needed for reporting", () => {
      expect(Money.toTaka(-5050n)).toBe("-50.50");
    });
  });

  describe("format", () => {
    it("formats with taka symbol and comma separators", () => {
      expect(Money.format(125050n)).toBe("৳ 1,250.50");
      expect(Money.format(100000075n)).toBe("৳ 1,000,000.75");
      expect(Money.format(0n)).toBe("৳ 0.00");
    });

    it("formats with currency code when symbol is false", () => {
      expect(Money.format(125050n, { symbol: false })).toBe("1,250.50 BDT");
    });
  });

  describe("arithmetic helpers", () => {
    it("adds poisha amounts correctly", () => {
      expect(Money.add(10050n, 5025n)).toBe(15075n);
    });

    it("subtracts poisha amounts correctly", () => {
      expect(Money.subtract(10050n, 5025n)).toBe(5025n);
    });

    it("throws RangeError if subtraction results in negative poisha", () => {
      expect(() => Money.subtract(1000n, 2000n)).toThrow("negative poisha");
    });

    it("multiplies poisha amounts", () => {
      expect(Money.multiply(100n, 3n)).toBe(300n);
    });

    it("divides poisha amounts with integer division", () => {
      expect(Money.divide(100n, 3n)).toBe(33n);
      expect(() => Money.divide(100n, 0n)).toThrow("Division by zero");
    });

    it("evaluates comparisons accurately", () => {
      expect(Money.compare(200n, 100n)).toBe(1);
      expect(Money.compare(100n, 200n)).toBe(-1);
      expect(Money.compare(100n, 100n)).toBe(0);
      expect(Money.isZero(0n)).toBe(true);
      expect(Money.isZero(5n)).toBe(false);
      expect(Money.isPositive(1n)).toBe(true);
      expect(Money.isPositive(0n)).toBe(false);
    });
  });
});
