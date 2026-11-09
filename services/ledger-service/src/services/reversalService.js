import crypto from "node:crypto";
import { getPool } from "../db/pool.js";
import { EntryBuilder } from "../domain/entryBuilder.js";
import {
  NotFoundError,
  InsufficientFundsError,
  AccountFrozenError,
  ValidationError,
} from "../utils/errors.js";

export class ReversalService {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Admin reversal creates a compensating entry (never deletes); prevents double reversal.
   * Swaps all debits and credits and links to original via `reverses_entry_id`.
   */
  async reverseTransaction({ entryId, actorId = null, reason = "Admin manual reversal" }) {
    if (!entryId) {
      throw new ValidationError("entryId is required to reverse transaction");
    }

    const pool = this.getDbPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Lock and fetch original journal entry
      const entryRes = await client.query(
        "SELECT * FROM journal_entries WHERE id = $1 FOR UPDATE",
        [entryId]
      );

      if (entryRes.rows.length === 0) {
        throw new NotFoundError(`Transaction not found: ${entryId}`);
      }

      const originalEntry = entryRes.rows[0];

      if (originalEntry.status === "REVERSED") {
        const err = new Error(`Transaction ${entryId} has already been reversed`);
        err.code = "CANNOT_REVERSE_ALREADY_REVERSED";
        err.statusCode = 400;
        throw err;
      }

      if (originalEntry.type === "REVERSAL") {
        const err = new Error("Cannot reverse a reversal transaction");
        err.code = "CANNOT_REVERSE_A_REVERSAL";
        err.statusCode = 400;
        throw err;
      }

      // Check if another reversal references this entry
      const checkExisting = await client.query(
        "SELECT id FROM journal_entries WHERE reverses_entry_id = $1 LIMIT 1",
        [entryId]
      );
      if (checkExisting.rows.length > 0) {
        const err = new Error(`Transaction ${entryId} already has an existing reversal entry`);
        err.code = "CANNOT_REVERSE_ALREADY_REVERSED";
        err.statusCode = 400;
        throw err;
      }

      // 2. Fetch original ledger lines
      const linesRes = await client.query(
        "SELECT id, entry_id, account_id, direction, amount FROM ledger_lines WHERE entry_id = $1 ORDER BY id ASC",
        [entryId]
      );

      if (linesRes.rows.length < 2) {
        throw new ValidationError(`Original transaction ${entryId} does not have sufficient ledger lines`);
      }

      const originalLines = linesRes.rows.map((row) => ({
        id: row.id,
        entryId: row.entry_id,
        accountId: row.account_id,
        direction: row.direction,
        amount: BigInt(row.amount),
      }));

      // 3. Build compensating reversal entry using EntryBuilder
      const reversalEntryId = crypto.randomUUID();
      const reversalRef = `REV-${originalEntry.reference || entryId.slice(0, 8)}-${Date.now()}`;
      const { entry: reversalEntry, lines: reversalLines } = EntryBuilder.buildReversalEntry({
        originalEntry,
        originalLines,
        reversalEntryId,
        reference: reversalRef,
        reason,
      });

      // 4. Lock affected accounts deterministically in ascending ID order
      const accountIds = Array.from(new Set(reversalLines.map((l) => l.accountId))).sort();
      const accountsRes = await client.query(
        `SELECT id, owner_id, type, balance, status
         FROM accounts
         WHERE id = ANY($1::uuid[])
         ORDER BY id ASC
         FOR UPDATE`,
        [accountIds]
      );

      const accountsMap = new Map();
      for (const row of accountsRes.rows) {
        accountsMap.set(row.id, {
          ...row,
          balance: BigInt(row.balance),
        });
      }

      // 5. Verify accounts exist and have sufficient funds if balance delta is negative
      const balanceDeltas = new Map();
      for (const line of reversalLines) {
        const acc = accountsMap.get(line.accountId);
        if (!acc) {
          throw new NotFoundError(`Account not found: ${line.accountId}`);
        }
        if (acc.status === "FROZEN") {
          throw new AccountFrozenError(`Account ${line.accountId} is frozen`);
        }

        const delta = balanceDeltas.get(line.accountId) || 0n;
        if (line.direction === "DEBIT") {
          balanceDeltas.set(line.accountId, delta - BigInt(line.amount));
        } else {
          balanceDeltas.set(line.accountId, delta + BigInt(line.amount));
        }
      }

      // Ensure user/merchant wallets never go negative on reversal
      for (const [accId, delta] of balanceDeltas.entries()) {
        const acc = accountsMap.get(accId);
        const newBalance = acc.balance + delta;
        if (["USER_WALLET", "MERCHANT_WALLET"].includes(acc.type) && newBalance < 0n) {
          throw new InsufficientFundsError(
            `Insufficient funds in account ${accId} to process reversal. Current balance: ${acc.balance}, required debit: ${-delta}`
          );
        }
      }

      // 6. Insert reversal journal entry
      const insertRevSql = `
        INSERT INTO journal_entries (id, type, status, reference, description, reverses_entry_id, initiated_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, type, status, reference, description, reverses_entry_id, initiated_by, created_at
      `;
      const insertedEntryRes = await client.query(insertRevSql, [
        reversalEntry.id,
        reversalEntry.type,
        reversalEntry.status,
        reversalEntry.reference,
        reversalEntry.description,
        reversalEntry.reversesEntryId,
        actorId,
      ]);

      // 7. Insert swapped compensating ledger lines
      const insertedLines = [];
      for (const line of reversalLines) {
        const lineInsert = await client.query(
          `INSERT INTO ledger_lines (entry_id, account_id, direction, amount, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id, entry_id, account_id, direction, amount, created_at`,
          [reversalEntry.id, line.accountId, line.direction, line.amount.toString()]
        );
        insertedLines.push({
          ...lineInsert.rows[0],
          amount: lineInsert.rows[0].amount.toString(),
        });
      }

      // 8. Update cached account balances
      for (const [accId, delta] of balanceDeltas.entries()) {
        await client.query(
          `UPDATE accounts
           SET balance = balance + $1, version = version + 1, updated_at = NOW()
           WHERE id = $2`,
          [delta.toString(), accId]
        );
      }

      // 9. Update original journal entry status to REVERSED
      await client.query(
        "UPDATE journal_entries SET status = 'REVERSED' WHERE id = $1",
        [originalEntry.id]
      );

      // 10. Audit log
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          actorId,
          "REVERSE_TRANSACTION",
          "JOURNAL_ENTRY",
          originalEntry.id,
          JSON.stringify({
            reversalEntryId: reversalEntry.id,
            reversalReference: reversalEntry.reference,
            reason,
            linesCount: insertedLines.length,
          }),
        ]
      );

      // 11. Transactional outbox event
      await client.query(
        `INSERT INTO outbox (topic, payload, created_at)
         VALUES ($1, $2, NOW())`,
        [
          "TRANSACTION_REVERSED",
          JSON.stringify({
            originalEntryId: originalEntry.id,
            reversalEntryId: reversalEntry.id,
            actorId,
            reason,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      await client.query("COMMIT");

      return {
        originalEntryId: originalEntry.id,
        reversalEntry: insertedEntryRes.rows[0],
        reversalLines: insertedLines,
        reason,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
