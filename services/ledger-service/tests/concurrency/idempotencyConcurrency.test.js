import { describe, it, expect } from "@jest/globals";
import { createConcurrencyDb } from "./concurrencyHarness.js";

describe("Concurrency: Idempotent Concurrent Replay", () => {
  it("same idempotency key sent 10 times simultaneously creates exactly one transaction", async () => {
    const { accounts, journalEntries, transferService } = createConcurrencyDb({
      initialAccounts: [
        { id: "acc-alice", owner_id: "user-alice", type: "USER_WALLET", balance: 100000n, status: "ACTIVE" },
        { id: "acc-bob", owner_id: "user-bob", type: "USER_WALLET", balance: 50000n, status: "ACTIVE" },
        { id: "acc-fee", owner_id: null, type: "SYSTEM_FEE_REVENUE", balance: 0n, status: "ACTIVE" },
      ],
    });

    const sharedIdempotencyKey = "shared-uuid-key-concurrent-test";
    const amountPoisha = 10000n; // 100 Taka

    // Fire 10 concurrent requests at the exact same instant
    const promises = Array.from({ length: 10 }).map(() =>
      transferService.transferP2P({
        senderUserId: "user-alice",
        receiverPhone: "user-bob",
        amountPoisha,
        idempotencyKey: sharedIdempotencyKey,
      })
    );

    const responses = await Promise.all(promises);

    // All 10 requests must succeed with statusCode 200
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe("COMPLETED");
    }

    // All 10 responses must reference the EXACT SAME transactionId and reference
    const firstTxnId = responses[0].data.transactionId;
    const firstRef = responses[0].data.reference;
    for (const res of responses) {
      expect(res.data.transactionId).toBe(firstTxnId);
      expect(res.data.reference).toBe(firstRef);
    }

    // Exactly 1 journal entry exists in the database
    expect(journalEntries.size).toBe(1);

    // Sender deducted only once: 100,000 - 10,500 = 89,500
    expect(accounts.get("acc-alice").balance).toBe(89500n);
    // Receiver credited only once: 50,000 + 10,000 = 60,000
    expect(accounts.get("acc-bob").balance).toBe(60000n);
  });
});
