import crypto from "node:crypto";
import { getPool } from "../db/pool.js";
import { EntryBuilder } from "../domain/entryBuilder.js";
import { LedgerRepository } from "../repositories/ledgerRepository.js";
import { verifyWebhookSignature } from "../utils/webhookSignature.js";
import { getEnv } from "../config/env.js";

export class TopUpService {
  constructor(ledgerRepo = new LedgerRepository(), pool = null) {
    this.ledgerRepo = ledgerRepo;
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Initiate a wallet top-up request.
   */
  async initiateTopUp({ userId, amountPoisha, providerRef = null, customClient = null }) {
    const amount = BigInt(amountPoisha);
    if (amount <= 0n) throw new Error("Top-up amount must be positive");

    const ref = providerRef || `topup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      const res = await client.query(
        `INSERT INTO top_ups (user_id, amount, provider_ref, status)
         VALUES ($1, $2, $3, 'INITIATED')
         RETURNING id, user_id, amount, provider_ref, status, created_at`,
        [userId, amount.toString(), ref]
      );

      return {
        ...res.rows[0],
        amount: BigInt(res.rows[0].amount),
      };
    } finally {
      if (shouldRelease) client.release();
    }
  }

  /**
   * Handle HMAC-signed webhook callback from mock provider.
   */
  async handleWebhook({
    payload,
    signature,
    timestamp,
    webhookSecret = null,
    customClient = null,
  }) {
    const secret = webhookSecret || getEnv().WEBHOOK_SECRET;

    // 1. Verify HMAC signature and timestamp tolerance
    const isValidSignature = verifyWebhookSignature({
      payload,
      signature,
      timestamp,
      secret,
      toleranceSeconds: 300,
    });

    if (!isValidSignature) {
      const err = new Error("Invalid or expired webhook signature");
      err.code = "INVALID_WEBHOOK_SIGNATURE";
      err.statusCode = 401;
      throw err;
    }

    const { providerRef, status, amount } = payload;
    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      await client.query("BEGIN");

      // 2. Fetch top-up record FOR UPDATE
      const topUpRes = await client.query(
        "SELECT * FROM top_ups WHERE provider_ref = $1 FOR UPDATE",
        [providerRef]
      );

      if (topUpRes.rows.length === 0) {
        throw new Error(`Top-up not found for provider reference: ${providerRef}`);
      }

      const topUp = topUpRes.rows[0];

      // Replay protection: if already completed, return idempotent success
      if (topUp.status === "COMPLETED") {
        await client.query("COMMIT");
        return {
          success: true,
          status: "COMPLETED",
          alreadyProcessed: true,
          topUpId: topUp.id,
        };
      }

      if (status !== "SUCCESS") {
        await client.query(
          "UPDATE top_ups SET status = 'FAILED', completed_at = NOW() WHERE id = $1",
          [topUp.id]
        );
        await client.query("COMMIT");
        return { success: false, status: "FAILED", topUpId: topUp.id };
      }

      // 3. Find user wallet account and bank clearing account
      const userAccRes = await client.query(
        "SELECT id FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [topUp.user_id]
      );
      if (userAccRes.rows.length === 0) {
        throw new Error(`User wallet account not found for user: ${topUp.user_id}`);
      }
      const userAccountId = userAccRes.rows[0].id;

      let bankAccRes = await client.query(
        "SELECT id FROM accounts WHERE type = 'SYSTEM_BANK_CLEARING' LIMIT 1"
      );
      let bankAccountId;
      if (bankAccRes.rows.length === 0) {
        const createBank = await client.query(
          `INSERT INTO accounts (type, currency, balance, status)
           VALUES ('SYSTEM_BANK_CLEARING', 'BDT', 0, 'ACTIVE')
           RETURNING id`
        );
        bankAccountId = createBank.rows[0].id;
      } else {
        bankAccountId = bankAccRes.rows[0].id;
      }

      // 4. Build and post balanced Top-Up journal entry
      const { entry, lines } = EntryBuilder.buildTopUpEntry({
        userAccountId,
        bankAccountId,
        amountPoisha: BigInt(topUp.amount),
        reference: `ref-${topUp.provider_ref}`,
        description: `Top-up from provider ${topUp.provider_ref}`,
      });

      const posted = await this.ledgerRepo.postEntry({
        entry,
        lines,
        customClient: client,
      });

      // 5. Mark top-up COMPLETED
      await client.query(
        "UPDATE top_ups SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1",
        [topUp.id]
      );

      await client.query("COMMIT");

      return {
        success: true,
        status: "COMPLETED",
        topUpId: topUp.id,
        journalEntryId: posted.entry.id,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      if (shouldRelease) client.release();
    }
  }
}
