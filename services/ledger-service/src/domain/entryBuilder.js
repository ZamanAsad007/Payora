import crypto from "node:crypto";

/**
 * EntryBuilder: Creates balanced debit/credit lines for all financial transactions.
 *
 * Double-Entry Principle:
 * For every journal entry: sum(Debits) === sum(Credits).
 * Lines are append-only and strictly balanced.
 */
export class EntryBuilder {
  /**
   * Validates that lines are balanced and meet minimal requirements.
   */
  static validate(lines) {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new Error("Journal entry must have at least 2 ledger lines");
    }

    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const line of lines) {
      if (!line.accountId) throw new Error("Each ledger line must have an accountId");
      if (!line.direction || !["DEBIT", "CREDIT"].includes(line.direction)) {
        throw new Error("Each ledger line must have direction 'DEBIT' or 'CREDIT'");
      }
      const amount = BigInt(line.amount);
      if (amount <= 0n) {
        throw new Error("Ledger line amount must be strictly greater than 0");
      }

      if (line.direction === "DEBIT") {
        totalDebits += amount;
      } else {
        totalCredits += amount;
      }
    }

    if (totalDebits !== totalCredits) {
      throw new Error(
        `Journal entry is unbalanced: total debits (${totalDebits}) != total credits (${totalCredits})`
      );
    }

    return true;
  }

  /**
   * Top-Up Entry:
   * Debit: SYSTEM_BANK_CLEARING (Asset increases)
   * Credit: USER_WALLET (Liability increases)
   */
  static buildTopUpEntry({
    entryId = crypto.randomUUID(),
    userAccountId,
    bankAccountId,
    amountPoisha,
    reference,
    description = "Wallet Top-up via payment provider",
  }) {
    const amount = BigInt(amountPoisha);
    if (amount <= 0n) throw new Error("Top-up amount must be positive");

    const lines = [
      {
        entryId,
        accountId: bankAccountId,
        direction: "DEBIT",
        amount,
      },
      {
        entryId,
        accountId: userAccountId,
        direction: "CREDIT",
        amount,
      },
    ];

    this.validate(lines);

    return {
      entry: {
        id: entryId,
        type: "TOP_UP",
        status: "COMPLETED",
        reference,
        description,
        reversesEntryId: null,
      },
      lines,
    };
  }

  /**
   * P2P Transfer Entry:
   * Debit: Sender USER_WALLET (amount + fee)
   * Credit: Receiver USER_WALLET (amount)
   * Credit: SYSTEM_FEE_REVENUE (fee, if > 0)
   */
  static buildP2PEntry({
    entryId = crypto.randomUUID(),
    senderAccountId,
    receiverAccountId,
    feeAccountId,
    amountPoisha,
    feePoisha = 0n,
    reference,
    description = "P2P transfer",
  }) {
    if (senderAccountId === receiverAccountId) {
      throw new Error("Sender and receiver accounts cannot be the same");
    }

    const amount = BigInt(amountPoisha);
    const fee = BigInt(feePoisha);
    if (amount <= 0n) throw new Error("Transfer amount must be positive");
    if (fee < 0n) throw new Error("Fee cannot be negative");

    const lines = [
      {
        entryId,
        accountId: senderAccountId,
        direction: "DEBIT",
        amount: amount + fee,
      },
      {
        entryId,
        accountId: receiverAccountId,
        direction: "CREDIT",
        amount,
      },
    ];

    if (fee > 0n) {
      if (!feeAccountId) throw new Error("Fee account required when fee > 0");
      lines.push({
        entryId,
        accountId: feeAccountId,
        direction: "CREDIT",
        amount: fee,
      });
    }

    this.validate(lines);

    return {
      entry: {
        id: entryId,
        type: "P2P",
        status: "COMPLETED",
        reference,
        description,
        reversesEntryId: null,
      },
      lines,
    };
  }

  /**
   * Merchant Payment Entry:
   * Debit: Customer USER_WALLET (amount + fee)
   * Credit: Merchant MERCHANT_WALLET (amount)
   * Credit: SYSTEM_FEE_REVENUE (fee, if > 0)
   */
  static buildMerchantPaymentEntry({
    entryId = crypto.randomUUID(),
    customerAccountId,
    merchantAccountId,
    feeAccountId,
    amountPoisha,
    feePoisha = 0n,
    reference,
    description = "Merchant purchase payment",
  }) {
    const amount = BigInt(amountPoisha);
    const fee = BigInt(feePoisha);
    if (amount <= 0n) throw new Error("Payment amount must be positive");
    if (fee < 0n) throw new Error("Fee cannot be negative");

    const lines = [
      {
        entryId,
        accountId: customerAccountId,
        direction: "DEBIT",
        amount: amount + fee,
      },
      {
        entryId,
        accountId: merchantAccountId,
        direction: "CREDIT",
        amount,
      },
    ];

    if (fee > 0n) {
      if (!feeAccountId) throw new Error("Fee account required when fee > 0");
      lines.push({
        entryId,
        accountId: feeAccountId,
        direction: "CREDIT",
        amount: fee,
      });
    }

    this.validate(lines);

    return {
      entry: {
        id: entryId,
        type: "MERCHANT_PAYMENT",
        status: "COMPLETED",
        reference,
        description,
        reversesEntryId: null,
      },
      lines,
    };
  }

  /**
   * Cash-Out Entry:
   * Debit: User USER_WALLET (amount + fee)
   * Credit: Agent SYSTEM_AGENT_CASH (amount)
   * Credit: SYSTEM_FEE_REVENUE (fee)
   */
  static buildCashOutEntry({
    entryId = crypto.randomUUID(),
    userAccountId,
    agentAccountId,
    feeAccountId,
    amountPoisha,
    feePoisha,
    reference,
    description = "Cash-out via agent",
  }) {
    const amount = BigInt(amountPoisha);
    const fee = BigInt(feePoisha);
    if (amount <= 0n) throw new Error("Cash out amount must be positive");
    if (fee < 0n) throw new Error("Fee cannot be negative");

    const lines = [
      {
        entryId,
        accountId: userAccountId,
        direction: "DEBIT",
        amount: amount + fee,
      },
      {
        entryId,
        accountId: agentAccountId,
        direction: "CREDIT",
        amount,
      },
    ];

    if (fee > 0n) {
      if (!feeAccountId) throw new Error("Fee account required when fee > 0");
      lines.push({
        entryId,
        accountId: feeAccountId,
        direction: "CREDIT",
        amount: fee,
      });
    }

    this.validate(lines);

    return {
      entry: {
        id: entryId,
        type: "CASH_OUT",
        status: "COMPLETED",
        reference,
        description,
        reversesEntryId: null,
      },
      lines,
    };
  }

  /**
   * Compensating Reversal Entry:
   * Swaps every DEBIT to a CREDIT and every CREDIT to a DEBIT.
   * Total Debits == Total Credits remains invariant.
   */
  static buildReversalEntry({
    originalEntry,
    originalLines,
    reversalEntryId = crypto.randomUUID(),
    reference,
    reason = "Transaction reversal",
  }) {
    if (!originalEntry || !originalLines || originalLines.length < 2) {
      throw new Error("Valid original entry and lines required for reversal");
    }

    if (originalEntry.status === "REVERSED") {
      throw new Error("Cannot reverse an already reversed transaction");
    }

    const reversalLines = originalLines.map((line) => ({
      entryId: reversalEntryId,
      accountId: line.accountId,
      direction: line.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: BigInt(line.amount),
    }));

    this.validate(reversalLines);

    return {
      entry: {
        id: reversalEntryId,
        type: "REVERSAL",
        status: "COMPLETED",
        reference,
        description: `Reversal of ${originalEntry.id}: ${reason}`,
        reversesEntryId: originalEntry.id,
      },
      lines: reversalLines,
    };
  }
}
