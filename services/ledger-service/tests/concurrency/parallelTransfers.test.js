import { describe, it, expect } from "@jest/globals";
import crypto from "node:crypto";
import { createConcurrencyDb } from "./concurrencyHarness.js";

describe("Concurrency: 1,000 Parallel Transfers", () => {
  it("executes 1000 parallel transfers: books balance, no negative balance, money conserved", async () => {
    // 4 user accounts with 1,000.00 Taka (100,000 poisha) each = 400,000 poisha total
    const initialUsers = [
      { id: "acc-user-1", owner_id: "user-1", type: "USER_WALLET", balance: 100000n, status: "ACTIVE" },
      { id: "acc-user-2", owner_id: "user-2", type: "USER_WALLET", balance: 100000n, status: "ACTIVE" },
      { id: "acc-user-3", owner_id: "user-3", type: "USER_WALLET", balance: 100000n, status: "ACTIVE" },
      { id: "acc-user-4", owner_id: "user-4", type: "USER_WALLET", balance: 100000n, status: "ACTIVE" },
      { id: "acc-fee-rev", owner_id: null, type: "SYSTEM_FEE_REVENUE", balance: 0n, status: "ACTIVE" },
    ];

    const initialTotalMoney = initialUsers.reduce((sum, a) => sum + a.balance, 0n);

    const { accounts, journalEntries, ledgerLines, transferService } = createConcurrencyDb({
      initialAccounts: initialUsers,
    });

    const userIds = ["user-1", "user-2", "user-3", "user-4"];
    const NUM_TRANSFERS = 1000;

    const transferTasks = [];
    for (let i = 0; i < NUM_TRANSFERS; i++) {
      const senderIdx = Math.floor(Math.random() * userIds.length);
      let receiverIdx = Math.floor(Math.random() * userIds.length);
      while (receiverIdx === senderIdx) {
        receiverIdx = Math.floor(Math.random() * userIds.length);
      }

      const senderId = userIds[senderIdx];
      const receiverId = userIds[receiverIdx];
      // Random transfer amount: 10 to 500 Taka (1,000 to 50,000 poisha)
      const amountPoisha = BigInt(Math.floor(Math.random() * 5000) + 100);
      const idempotencyKey = crypto.randomUUID();

      const task = transferService
        .transferP2P({
          senderUserId: senderId,
          receiverPhone: receiverId,
          amountPoisha,
          idempotencyKey,
        })
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, reason: err.code }));

      transferTasks.push(task);
    }

    const results = await Promise.all(transferTasks);
    const successfulTransfers = results.filter((r) => r.success).length;
    const failedTransfers = results.filter((r) => !r.success).length;

    expect(successfulTransfers + failedTransfers).toBe(NUM_TRANSFERS);

    // Invariant 1: No user account balance ever goes below 0
    for (const [id, acc] of accounts.entries()) {
      if (acc.type === "USER_WALLET") {
        expect(acc.balance >= 0n).toBe(true);
      }
    }

    // Invariant 2: Total money is conserved!
    // Sum of all user balances + fee revenue === initial total money
    const finalTotalMoney = Array.from(accounts.values()).reduce(
      (sum, acc) => sum + acc.balance,
      0n
    );

    expect(finalTotalMoney).toBe(initialTotalMoney);

    // Invariant 3: For every journal entry, debits equal credits
    const linesByEntry = new Map();
    for (const line of ledgerLines) {
      if (!linesByEntry.has(line.entry_id)) {
        linesByEntry.set(line.entry_id, []);
      }
      linesByEntry.get(line.entry_id).push(line);
    }

    for (const [entryId, lines] of linesByEntry.entries()) {
      let debits = 0n;
      let credits = 0n;
      for (const line of lines) {
        if (line.direction === "DEBIT") debits += BigInt(line.amount);
        if (line.direction === "CREDIT") credits += BigInt(line.amount);
      }
      expect(debits).toBe(credits);
    }
  });
});
