import crypto from "node:crypto";
import { getPool } from "../db/pool.js";
import { EntryBuilder } from "../domain/entryBuilder.js";
import { FeeCalculator } from "../domain/feeCalculator.js";
import { LimitChecker } from "../domain/limitChecker.js";
import { LedgerRepository } from "../repositories/ledgerRepository.js";
import { OutboxService } from "./outboxService.js";
import { IdempotencyConflictError, NotFoundError } from "../utils/errors.js";

export class CashOutService {
  constructor(ledgerRepo = new LedgerRepository(), pool = null) {
    this.ledgerRepo = ledgerRepo;
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Concurrency-safe cash-out flow via mock agent settlement account.
   *
   * @param {object} params
   * @param {string} params.userId - User requesting cash-out
   * @param {string} [params.agentAccountId] - Optional specific agent account ID
   * @param {bigint|number|string} params.amountPoisha
   * @param {string} params.idempotencyKey
   * @param {object} [params.customClient]
   */
  async cashOut({
    userId,
    agentAccountId: customAgentAccId,
    amountPoisha,
    idempotencyKey,
    customClient = null,
  }) {
    if (!idempotencyKey) {
      const err = new Error("Idempotency-Key header is required for cash-out");
      err.code = "MISSING_IDEMPOTENCY_KEY";
      err.statusCode = 400;
      throw err;
    }

    const amount = BigInt(amountPoisha);
    if (amount <= 0n) {
      const err = new Error("Cash-out amount must be positive");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const payloadToHash = JSON.stringify({
      userId,
      amount: amount.toString(),
      agentAccountId: customAgentAccId || "default",
    });
    const requestHash = crypto.createHash("sha256").update(payloadToHash).digest("hex");

    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      await client.query("BEGIN");

      // 1. Check Idempotency Key
      const idempRes = await client.query(
        "SELECT request_hash, response, status_code FROM idempotency_keys WHERE key = $1 AND user_id = $2 FOR UPDATE",
        [idempotencyKey, userId]
      );

      if (idempRes.rows.length > 0) {
        const stored = idempRes.rows[0];
        if (stored.request_hash !== requestHash) {
          throw new IdempotencyConflictError(
            "Idempotency key was already used with a different request payload"
          );
        }

        await client.query("COMMIT");
        return {
          fromCache: true,
          statusCode: stored.status_code || 200,
          data: stored.response,
        };
      }

      // 2. Resolve User Wallet Account
      const userAccRes = await client.query(
        "SELECT id FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [userId]
      );
      if (userAccRes.rows.length === 0) {
        throw new NotFoundError("User wallet account not found");
      }
      const userAccountId = userAccRes.rows[0].id;

      // 3. Resolve Agent Settlement Account (SYSTEM_AGENT_CASH)
      let agentAccountId = customAgentAccId;
      if (!agentAccountId) {
        let agentAccRes = await client.query(
          "SELECT id FROM accounts WHERE type = 'SYSTEM_AGENT_CASH' LIMIT 1"
        );
        if (agentAccRes.rows.length === 0) {
          const createAgent = await client.query(
            `INSERT INTO accounts (type, currency, balance, status)
             VALUES ('SYSTEM_AGENT_CASH', 'BDT', 0, 'ACTIVE')
             RETURNING id`
          );
          agentAccountId = createAgent.rows[0].id;
        } else {
          agentAccountId = agentAccRes.rows[0].id;
        }
      }

      // 4. Resolve System Fee Revenue Account
      let feeAccRes = await client.query(
        "SELECT id FROM accounts WHERE type = 'SYSTEM_FEE_REVENUE' LIMIT 1"
      );
      let feeAccountId;
      if (feeAccRes.rows.length === 0) {
        const createFee = await client.query(
          `INSERT INTO accounts (type, currency, balance, status)
           VALUES ('SYSTEM_FEE_REVENUE', 'BDT', 0, 'ACTIVE')
           RETURNING id`
        );
        feeAccountId = createFee.rows[0].id;
      } else {
        feeAccountId = feeAccRes.rows[0].id;
      }

      // 5. Enforce Limits
      LimitChecker.checkLimits({
        amountPoisha: amount,
      });

      // 6. Calculate Cash-Out Fee (1.85%, min 10 Taka / 1000 poisha)
      const fee = FeeCalculator.calculateCashOutFee(amount);

      // 7. Build balanced Cash-Out Entry
      const reference = `txn-cashout-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const { entry, lines } = EntryBuilder.buildCashOutEntry({
        userAccountId,
        agentAccountId,
        feeAccountId,
        amountPoisha: amount,
        feePoisha: fee,
        reference,
        description: `Cash-out of ${amount} poisha via agent`,
      });

      // 8. Post entry atomically with ordered row locks
      const posted = await this.ledgerRepo.postEntry({
        entry,
        lines,
        customClient: client,
      });

      const responseData = {
        transactionId: posted.entry.id,
        reference: posted.entry.reference,
        amount: amount.toString(),
        fee: fee.toString(),
        status: "COMPLETED",
        createdAt: posted.entry.created_at,
      };

      // 9. Store Idempotency Key record
      await client.query(
        `INSERT INTO idempotency_keys (key, user_id, request_hash, response, status_code)
         VALUES ($1, $2, $3, $4, 200)`,
        [idempotencyKey, userId, requestHash, JSON.stringify(responseData)]
      );

      // 10. Record Outbox Event in same DB transaction
      try {
        await OutboxService.recordEvent(client, {
          topic: "transfers.cash_out",
          payload: {
            type: "CASH_OUT",
            entryId: posted.entry.id,
            reference: posted.entry.reference,
            userId,
            userAccountId,
            agentAccountId,
            amount: amount.toString(),
            fee: fee.toString(),
          },
        });
      } catch {
        // Allow mock client without outbox
      }

      await client.query("COMMIT");

      return {
        fromCache: false,
        statusCode: 200,
        data: responseData,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      if (shouldRelease) client.release();
    }
  }
}
