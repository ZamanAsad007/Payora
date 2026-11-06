import crypto from "node:crypto";
import { getPool } from "../db/pool.js";
import { EntryBuilder } from "../domain/entryBuilder.js";
import { FeeCalculator } from "../domain/feeCalculator.js";
import { LimitChecker } from "../domain/limitChecker.js";
import { LedgerRepository } from "../repositories/ledgerRepository.js";
import { IdempotencyConflictError, NotFoundError } from "../utils/errors.js";

export class TransferService {
  constructor(ledgerRepo = new LedgerRepository(), pool = null) {
    this.ledgerRepo = ledgerRepo;
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Concurrency-safe P2P transfer with strict idempotency and ordered row-level locking.
   *
   * @param {object} params
   * @param {string} params.senderUserId
   * @param {string} params.receiverPhone - Recipient phone number or account ID
   * @param {bigint|number|string} params.amountPoisha
   * @param {string} params.idempotencyKey
   * @param {object} [params.customClient]
   */
  async transferP2P({
    senderUserId,
    receiverPhone,
    amountPoisha,
    idempotencyKey,
    customClient = null,
  }) {
    if (!idempotencyKey) {
      const err = new Error("Idempotency-Key header is required for money transfers");
      err.code = "MISSING_IDEMPOTENCY_KEY";
      err.statusCode = 400;
      throw err;
    }

    const amount = BigInt(amountPoisha);
    if (amount <= 0n) {
      const err = new Error("Transfer amount must be positive");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const payloadToHash = JSON.stringify({
      senderUserId,
      receiverPhone,
      amount: amount.toString(),
    });
    const requestHash = crypto.createHash("sha256").update(payloadToHash).digest("hex");

    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      await client.query("BEGIN");

      // 1. Check Idempotency Key
      const idempRes = await client.query(
        "SELECT request_hash, response, status_code FROM idempotency_keys WHERE key = $1 AND user_id = $2 FOR UPDATE",
        [idempotencyKey, senderUserId]
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

      // 2. Resolve Sender Account
      const senderAccRes = await client.query(
        "SELECT id FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [senderUserId]
      );
      if (senderAccRes.rows.length === 0) {
        throw new NotFoundError("Sender wallet account not found");
      }
      const senderAccountId = senderAccRes.rows[0].id;

      // 3. Resolve Receiver Account (by owner ID or lookup in accounts/users)
      let receiverAccRes = await client.query(
        "SELECT id, owner_id FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [receiverPhone]
      );

      // If not found by UUID directly, check if recipient is phone number
      if (receiverAccRes.rows.length === 0) {
        receiverAccRes = await client.query(
          `SELECT a.id, a.owner_id
           FROM accounts a
           JOIN users u ON u.id = a.owner_id
           WHERE u.phone = $1 AND a.type = 'USER_WALLET'`,
          [receiverPhone]
        );
      }

      if (receiverAccRes.rows.length === 0) {
        throw new NotFoundError(`Recipient wallet not found for: ${receiverPhone}`);
      }
      const receiverAccountId = receiverAccRes.rows[0].id;

      if (senderAccountId === receiverAccountId) {
        const err = new Error("Cannot transfer money to your own wallet account");
        err.code = "SELF_TRANSFER_NOT_ALLOWED";
        err.statusCode = 400;
        throw err;
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

      // 6. Calculate P2P Fee
      const fee = FeeCalculator.calculateP2PFee(amount);

      // 7. Build balanced P2P entry
      const reference = `txn-p2p-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const { entry, lines } = EntryBuilder.buildP2PEntry({
        senderAccountId,
        receiverAccountId,
        feeAccountId,
        amountPoisha: amount,
        feePoisha: fee,
        reference,
        description: `P2P transfer of ${amount} poisha to ${receiverPhone}`,
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
        [idempotencyKey, senderUserId, requestHash, JSON.stringify(responseData)]
      );

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
