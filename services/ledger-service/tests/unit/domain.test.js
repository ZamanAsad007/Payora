import { describe, it, expect } from "@jest/globals";
import { EntryBuilder } from "../../src/domain/entryBuilder.js";
import { FeeCalculator } from "../../src/domain/feeCalculator.js";
import { LimitChecker } from "../../src/domain/limitChecker.js";
import { TransactionStateMachine, TransactionState } from "../../src/domain/transactionStateMachine.js";

describe("Ledger Domain Components", () => {
  describe("EntryBuilder", () => {
    const bankAccount = "acc-bank-1";
    const userA = "acc-user-a";
    const userB = "acc-user-b";
    const feeAccount = "acc-fee-rev";

    it("builds balanced Top-Up entry", () => {
      const { entry, lines } = EntryBuilder.buildTopUpEntry({
        userAccountId: userA,
        bankAccountId: bankAccount,
        amountPoisha: 50000n, // 500 Taka
        reference: "ref-topup-1",
      });

      expect(entry.type).toBe("TOP_UP");
      expect(lines).toHaveLength(2);

      const debit = lines.find((l) => l.direction === "DEBIT");
      const credit = lines.find((l) => l.direction === "CREDIT");
      expect(debit.amount).toBe(50000n);
      expect(credit.amount).toBe(50000n);
      expect(debit.accountId).toBe(bankAccount);
      expect(credit.accountId).toBe(userA);
    });

    it("builds balanced P2P entry with fee", () => {
      const { entry, lines } = EntryBuilder.buildP2PEntry({
        senderAccountId: userA,
        receiverAccountId: userB,
        feeAccountId: feeAccount,
        amountPoisha: 10000n, // 100 Taka
        feePoisha: 500n, // 5 Taka
        reference: "ref-p2p-1",
      });

      expect(entry.type).toBe("P2P");
      expect(lines).toHaveLength(3);

      const senderLine = lines.find((l) => l.accountId === userA);
      const receiverLine = lines.find((l) => l.accountId === userB);
      const feeLine = lines.find((l) => l.accountId === feeAccount);

      expect(senderLine.direction).toBe("DEBIT");
      expect(senderLine.amount).toBe(10500n); // 10000 + 500
      expect(receiverLine.direction).toBe("CREDIT");
      expect(receiverLine.amount).toBe(10000n);
      expect(feeLine.direction).toBe("CREDIT");
      expect(feeLine.amount).toBe(500n);

      expect(EntryBuilder.validate(lines)).toBe(true);
    });

    it("builds compensating Reversal entry by swapping debits and credits", () => {
      const original = EntryBuilder.buildP2PEntry({
        senderAccountId: userA,
        receiverAccountId: userB,
        feeAccountId: feeAccount,
        amountPoisha: 20000n,
        feePoisha: 500n,
        reference: "ref-p2p-orig",
      });

      const reversal = EntryBuilder.buildReversalEntry({
        originalEntry: original.entry,
        originalLines: original.lines,
        reference: "ref-rev-1",
      });

      expect(reversal.entry.type).toBe("REVERSAL");
      expect(reversal.entry.reversesEntryId).toBe(original.entry.id);
      expect(reversal.lines).toHaveLength(original.lines.length);

      // Verify debits and credits swapped
      for (let i = 0; i < original.lines.length; i++) {
        const orig = original.lines[i];
        const rev = reversal.lines[i];
        expect(rev.accountId).toBe(orig.accountId);
        expect(rev.amount).toBe(orig.amount);
        expect(rev.direction).toBe(orig.direction === "DEBIT" ? "CREDIT" : "DEBIT");
      }

      expect(EntryBuilder.validate(reversal.lines)).toBe(true);
    });
  });

  describe("FeeCalculator", () => {
    it("calculates basis points percentage fee correctly", () => {
      // 10,000 Taka = 1,000,000 poisha at 1.85% (185 bps) = 18,500 poisha (185.00 Taka)
      const fee = FeeCalculator.calculate(1000000n, { basisPoints: 185 });
      expect(fee).toBe(18500n);
    });

    it("enforces minimum and maximum fee caps", () => {
      // Low amount with minimum 1000 poisha fee
      const minFee = FeeCalculator.calculate(1000n, { basisPoints: 185, minFeePoisha: 1000n });
      expect(minFee).toBe(1000n);

      // High amount with max 5000 poisha cap
      const maxFee = FeeCalculator.calculate(10000000n, { basisPoints: 100, maxFeePoisha: 5000n });
      expect(maxFee).toBe(5000n);
    });
  });

  describe("LimitChecker", () => {
    it("permits transaction within limits", () => {
      expect(
        LimitChecker.checkLimits({
          amountPoisha: 50000n,
          limits: { perTxnLimit: 100000n, dailySendLimit: 200000n, monthlyLimit: 500000n },
          currentDailyTotal: 20000n,
          currentMonthlyTotal: 50000n,
        })
      ).toBe(true);
    });

    it("rejects when per-transaction limit is exceeded", () => {
      expect(() =>
        LimitChecker.checkLimits({
          amountPoisha: 150000n,
          limits: { perTxnLimit: 100000n },
        })
      ).toThrow("exceeds maximum per-transaction limit");
    });

    it("rejects when daily limit would be exceeded", () => {
      expect(() =>
        LimitChecker.checkLimits({
          amountPoisha: 60000n,
          limits: { dailySendLimit: 100000n },
          currentDailyTotal: 50000n,
        })
      ).toThrow("would exceed daily limit");
    });
  });

  describe("TransactionStateMachine", () => {
    it("allows valid transitions", () => {
      expect(TransactionStateMachine.transition(TransactionState.PENDING, TransactionState.COMPLETED)).toBe(
        TransactionState.COMPLETED
      );
      expect(TransactionStateMachine.transition(TransactionState.COMPLETED, TransactionState.REVERSED)).toBe(
        TransactionState.REVERSED
      );
    });

    it("rejects invalid transitions", () => {
      expect(() =>
        TransactionStateMachine.transition(TransactionState.FAILED, TransactionState.COMPLETED)
      ).toThrow("Illegal transaction state transition");
      expect(() =>
        TransactionStateMachine.transition(TransactionState.REVERSED, TransactionState.COMPLETED)
      ).toThrow("Illegal transaction state transition");
    });
  });
});
