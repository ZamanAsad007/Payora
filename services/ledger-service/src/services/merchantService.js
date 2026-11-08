import crypto from "node:crypto";
import { getPool } from "../db/pool.js";
import { EntryBuilder } from "../domain/entryBuilder.js";
import { FeeCalculator } from "../domain/feeCalculator.js";
import { LimitChecker } from "../domain/limitChecker.js";
import { LedgerRepository } from "../repositories/ledgerRepository.js";
import { MerchantQr } from "../utils/merchantQr.js";
import { IdempotencyConflictError, NotFoundError } from "../utils/errors.js";

export class MerchantService {
  constructor(ledgerRepo = new LedgerRepository(), pool = null) {
    this.ledgerRepo = ledgerRepo;
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Register a new merchant and generate their QR code.
   *
   * @param {object} params
   * @param {string} [params.ownerId]
   * @param {string} params.name
   */
  async createMerchant({ ownerId = null, name }) {
    if (!name || name.trim().length === 0) {
      const err = new Error("Merchant name is required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const client = await this.getDbPool().connect();
    try {
      await client.query("BEGIN");

      // 1. Create merchant wallet account
      const accRes = await client.query(
        `INSERT INTO accounts (owner_id, type, currency, balance, status)
         VALUES ($1, 'MERCHANT_WALLET', 'BDT', 0, 'ACTIVE')
         RETURNING id, balance, status, currency`,
        [ownerId]
      );
      const accountId = accRes.rows[0].id;

      // 2. Pre-generate merchant ID
      const merchantId = crypto.randomUUID();

      // 3. Generate signed QR code payload
      const qrCode = MerchantQr.generate({
        merchantId,
        accountId,
        name: name.trim(),
      });

      // 4. Insert merchant record
      const merchRes = await client.query(
        `INSERT INTO merchants (id, owner_id, name, account_id, qr_code, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         RETURNING id, owner_id, name, account_id, qr_code, status, created_at`,
        [merchantId, ownerId, name.trim(), accountId, qrCode]
      );

      await client.query("COMMIT");

      return {
        ...merchRes.rows[0],
        account: {
          id: accountId,
          balance: "0",
          status: "ACTIVE",
          currency: "BDT",
        },
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get merchant by ID
   */
  async getMerchantById(merchantId) {
    const res = await this.getDbPool().query(
      `SELECT m.id, m.owner_id, m.name, m.account_id, m.qr_code, m.status, m.created_at,
              a.balance, a.currency, a.status as account_status
       FROM merchants m
       JOIN accounts a ON a.id = m.account_id
       WHERE m.id = $1`,
      [merchantId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError(`Merchant not found: ${merchantId}`);
    }

    const row = res.rows[0];
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      accountId: row.account_id,
      qrCode: row.qr_code,
      status: row.status,
      createdAt: row.created_at,
      balance: BigInt(row.balance),
      currency: row.currency,
      accountStatus: row.account_status,
    };
  }

  /**
   * Concurrency-safe, idempotent merchant payment endpoint.
   *
   * @param {object} params
   * @param {string} params.customerUserId
   * @param {string} [params.merchantId]
   * @param {string} [params.qrPayload]
   * @param {bigint|number|string} [params.amountPoisha]
   * @param {string} params.idempotencyKey
   * @param {object} [params.customClient]
   */
  async payMerchant({
    customerUserId,
    merchantId: providedMerchantId,
    qrPayload,
    amountPoisha,
    idempotencyKey,
    customClient = null,
  }) {
    if (!idempotencyKey) {
      const err = new Error("Idempotency-Key header is required for merchant payments");
      err.code = "MISSING_IDEMPOTENCY_KEY";
      err.statusCode = 400;
      throw err;
    }

    let merchantId = providedMerchantId;
    let presetAmount = null;

    // Validate QR code if supplied
    if (qrPayload) {
      const qrResult = MerchantQr.verify(qrPayload);
      if (!qrResult.valid) {
        const err = new Error(`Invalid QR code: ${qrResult.error}`);
        err.code = "INVALID_QR_CODE";
        err.statusCode = 400;
        throw err;
      }
      merchantId = qrResult.payload.merchantId;
      if (qrResult.payload.amount) {
        presetAmount = BigInt(qrResult.payload.amount);
      }
    }

    if (!merchantId) {
      const err = new Error("merchantId or valid qrPayload is required");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const effectiveAmount = presetAmount !== null ? presetAmount : BigInt(amountPoisha || 0);
    if (effectiveAmount <= 0n) {
      const err = new Error("Payment amount must be positive");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const payloadToHash = JSON.stringify({
      customerUserId,
      merchantId,
      amount: effectiveAmount.toString(),
    });
    const requestHash = crypto.createHash("sha256").update(payloadToHash).digest("hex");

    const client = customClient || (await this.getDbPool().connect());
    const shouldRelease = !customClient;

    try {
      await client.query("BEGIN");

      // 1. Check Idempotency Key
      const idempRes = await client.query(
        "SELECT request_hash, response, status_code FROM idempotency_keys WHERE key = $1 AND user_id = $2 FOR UPDATE",
        [idempotencyKey, customerUserId]
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

      // 2. Resolve Customer Account
      const custAccRes = await client.query(
        "SELECT id FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [customerUserId]
      );
      if (custAccRes.rows.length === 0) {
        throw new NotFoundError("Customer wallet account not found");
      }
      const customerAccountId = custAccRes.rows[0].id;

      // 3. Resolve Merchant & Merchant Account
      const merchRes = await client.query(
        `SELECT m.id, m.owner_id, m.name, m.account_id, m.status as merchant_status,
                a.status as account_status
         FROM merchants m
         JOIN accounts a ON a.id = m.account_id
         WHERE m.id = $1`,
        [merchantId]
      );
      if (merchRes.rows.length === 0) {
        throw new NotFoundError(`Merchant not found: ${merchantId}`);
      }
      const merchant = merchRes.rows[0];

      if (merchant.merchant_status !== "ACTIVE" || merchant.account_status !== "ACTIVE") {
        const err = new Error("Merchant account is currently not active");
        err.code = "MERCHANT_INACTIVE";
        err.statusCode = 400;
        throw err;
      }

      if (merchant.owner_id && merchant.owner_id === customerUserId) {
        const err = new Error("Cannot pay your own merchant account");
        err.code = "SELF_PAYMENT_NOT_ALLOWED";
        err.statusCode = 400;
        throw err;
      }
      const merchantAccountId = merchant.account_id;

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
        amountPoisha: effectiveAmount,
      });

      // 6. Calculate Merchant Fee (e.g. 1% capped at 50 Taka)
      const fee = FeeCalculator.calculateMerchantFee(effectiveAmount);

      // 7. Build balanced Merchant Payment Entry
      const reference = `txn-merch-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const { entry, lines } = EntryBuilder.buildMerchantPaymentEntry({
        customerAccountId,
        merchantAccountId,
        feeAccountId,
        amountPoisha: effectiveAmount,
        feePoisha: fee,
        reference,
        description: `Payment of ${effectiveAmount} poisha to merchant ${merchant.name}`,
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
        merchantId: merchant.id,
        merchantName: merchant.name,
        amount: effectiveAmount.toString(),
        fee: fee.toString(),
        status: "COMPLETED",
        createdAt: posted.entry.created_at,
      };

      // 9. Store Idempotency Key record
      await client.query(
        `INSERT INTO idempotency_keys (key, user_id, request_hash, response, status_code)
         VALUES ($1, $2, $3, $4, 200)`,
        [idempotencyKey, customerUserId, requestHash, JSON.stringify(responseData)]
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
