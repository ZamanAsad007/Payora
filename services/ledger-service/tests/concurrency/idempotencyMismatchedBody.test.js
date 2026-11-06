import { describe, it, expect } from "@jest/globals";
import { createConcurrencyDb } from "./concurrencyHarness.js";

describe("Concurrency: Idempotency Key Reused With Different Body", () => {
  it("returns IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY (409) when same key has different payload", async () => {
    const { transferService } = createConcurrencyDb({
      initialAccounts: [
        { id: "acc-user-1", owner_id: "user-1", type: "USER_WALLET", balance: 50000n, status: "ACTIVE" },
        { id: "acc-user-2", owner_id: "user-2", type: "USER_WALLET", balance: 50000n, status: "ACTIVE" },
        { id: "acc-user-3", owner_id: "user-3", type: "USER_WALLET", balance: 50000n, status: "ACTIVE" },
        { id: "acc-fee", owner_id: null, type: "SYSTEM_FEE_REVENUE", balance: 0n, status: "ACTIVE" },
      ],
    });

    const key = "reused-key-mismatched-body";

    // 1. Initial request: transfer 1000 poisha to user-2
    const firstRes = await transferService.transferP2P({
      senderUserId: "user-1",
      receiverPhone: "user-2",
      amountPoisha: 1000n,
      idempotencyKey: key,
    });
    expect(firstRes.statusCode).toBe(200);

    // 2. Reused with different amount: 5000 poisha to user-2
    await expect(
      transferService.transferP2P({
        senderUserId: "user-1",
        receiverPhone: "user-2",
        amountPoisha: 5000n, // Different amount
        idempotencyKey: key,
      })
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY",
      statusCode: 409,
    });

    // 3. Reused with different recipient: user-3
    await expect(
      transferService.transferP2P({
        senderUserId: "user-1",
        receiverPhone: "user-3", // Different recipient
        amountPoisha: 1000n,
        idempotencyKey: key,
      })
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY",
      statusCode: 409,
    });
  });
});
