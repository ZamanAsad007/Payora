import { describe, it } from "@jest/globals";
import fc from "fast-check";
import { EntryBuilder } from "../../src/domain/entryBuilder.js";
import { FeeCalculator } from "../../src/domain/feeCalculator.js";

describe("Ledger Invariant Property-Based Tests (fast-check)", () => {
  it("Invariant: ANY generated P2P entry is strictly balanced (sum(Debits) === sum(Credits))", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 100_000_000_000n }), // amounts up to 1 billion Taka
        fc.bigInt({ min: 0n, max: 100_000_000n }), // fees up to 1 million Taka
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (amount, fee, senderId, receiverId, feeId) => {
          // Exclude identical sender & receiver
          fc.pre(senderId !== receiverId);

          const { lines } = EntryBuilder.buildP2PEntry({
            senderAccountId: senderId,
            receiverAccountId: receiverId,
            feeAccountId: feeId,
            amountPoisha: amount,
            feePoisha: fee,
            reference: `ref-${Math.random()}`,
          });

          // Compute sum of debits and sum of credits
          let debits = 0n;
          let credits = 0n;
          for (const line of lines) {
            if (line.direction === "DEBIT") debits += line.amount;
            if (line.direction === "CREDIT") credits += line.amount;
          }

          return debits === credits && debits === amount + fee;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("Invariant: ANY generated Merchant entry is strictly balanced", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 100_000_000_000n }),
        fc.bigInt({ min: 0n, max: 50_000_000n }),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (amount, fee, custId, merchId, feeId) => {
          const { lines } = EntryBuilder.buildMerchantPaymentEntry({
            customerAccountId: custId,
            merchantAccountId: merchId,
            feeAccountId: feeId,
            amountPoisha: amount,
            feePoisha: fee,
            reference: `ref-${Math.random()}`,
          });

          let debits = 0n;
          let credits = 0n;
          for (const line of lines) {
            if (line.direction === "DEBIT") debits += line.amount;
            if (line.direction === "CREDIT") credits += line.amount;
          }

          return debits === credits;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("Invariant: Compensating reversal entry exactly mirrors debits into credits", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10_000_000_000n }),
        fc.bigInt({ min: 0n, max: 10_000_000n }),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (amount, fee, senderId, receiverId, feeId) => {
          fc.pre(senderId !== receiverId);

          const original = EntryBuilder.buildP2PEntry({
            senderAccountId: senderId,
            receiverAccountId: receiverId,
            feeAccountId: feeId,
            amountPoisha: amount,
            feePoisha: fee,
            reference: `ref-${Math.random()}`,
          });

          const reversal = EntryBuilder.buildReversalEntry({
            originalEntry: original.entry,
            originalLines: original.lines,
            reference: `rev-${Math.random()}`,
          });

          // Original debits must equal reversal credits
          const origDebits = original.lines
            .filter((l) => l.direction === "DEBIT")
            .reduce((sum, l) => sum + l.amount, 0n);

          const revCredits = reversal.lines
            .filter((l) => l.direction === "CREDIT")
            .reduce((sum, l) => sum + l.amount, 0n);

          const revDebits = reversal.lines
            .filter((l) => l.direction === "DEBIT")
            .reduce((sum, l) => sum + l.amount, 0n);

          return origDebits === revCredits && revDebits === revCredits;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("Invariant: Fee calculation never produces negative fees and respects caps", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 100_000_000_000n }),
        fc.integer({ min: 0, max: 1000 }), // 0% to 10% in basis points
        fc.bigInt({ min: 0n, max: 10000n }), // min fee
        fc.bigInt({ min: 10000n, max: 1_000_000n }), // max fee
        (amount, bps, minFee, maxFee) => {
          const fee = FeeCalculator.calculate(amount, {
            basisPoints: bps,
            minFeePoisha: minFee,
            maxFeePoisha: maxFee,
          });

          return fee >= minFee && fee <= maxFee && fee >= 0n;
        }
      ),
      { numRuns: 300 }
    );
  });
});
