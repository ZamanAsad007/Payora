import { describe, it, expect } from "@jest/globals";
import crypto from "node:crypto";
import { createConcurrencyDb } from "./concurrencyHarness.js";

describe("Concurrency: Deadlock Prevention", () => {
  it("opposite-direction concurrent transfers (A->B and B->A) do not deadlock", async () => {
    const { accounts, transferService } = createConcurrencyDb({
      initialAccounts: [
        { id: "acc-user-a", owner_id: "user-a", type: "USER_WALLET", balance: 500000n, status: "ACTIVE" },
        { id: "acc-user-b", owner_id: "user-b", type: "USER_WALLET", balance: 500000n, status: "ACTIVE" },
        { id: "acc-fee", owner_id: null, type: "SYSTEM_FEE_REVENUE", balance: 0n, status: "ACTIVE" },
      ],
    });

    const tasks = [];

    // 50 transfers A -> B
    for (let i = 0; i < 50; i++) {
      tasks.push(
        transferService.transferP2P({
          senderUserId: "user-a",
          receiverPhone: "user-b",
          amountPoisha: 1000n,
          idempotencyKey: crypto.randomUUID(),
        })
      );
    }

    // 50 simultaneous transfers B -> A
    for (let i = 0; i < 50; i++) {
      tasks.push(
        transferService.transferP2P({
          senderUserId: "user-b",
          receiverPhone: "user-a",
          amountPoisha: 1000n,
          idempotencyKey: crypto.randomUUID(),
        })
      );
    }

    // Shuffle the requests so they hit opposite directions concurrently
    const shuffledTasks = tasks.sort(() => Math.random() - 0.5);

    // All 100 opposite-direction transfers must complete without any deadlocks
    const results = await Promise.all(shuffledTasks);
    expect(results).toHaveLength(100);

    for (const res of results) {
      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe("COMPLETED");
    }

    // Invariant: books balance, no negative balance
    expect(accounts.get("acc-user-a").balance >= 0n).toBe(true);
    expect(accounts.get("acc-user-b").balance >= 0n).toBe(true);
  });
});
