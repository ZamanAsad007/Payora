import crypto from "node:crypto";
import { RuleEngine } from "../engine/ruleEngine.js";

export class RiskService {
  constructor({ pool = null, ruleEngine = new RuleEngine(), onAutoHold = null } = {}) {
    this.pool = pool;
    this.ruleEngine = ruleEngine;
    this.onAutoHold = onAutoHold; // callback or ledger freeze hook: async ({ userId, reason }) => {}
  }

  /**
   * Process an incoming financial event and raise risk flags if rules are violated.
   *
   * @param {object} event
   * @returns {Promise<object>} processing result with created flags
   */
  async processEvent(event) {
    const userId = event.userId || event.senderUserId || event.customerUserId;
    if (!userId) {
      throw new Error("Event missing userId");
    }

    const violations = this.ruleEngine.evaluate(event);
    const flagsCreated = [];
    let autoHoldTriggered = false;

    for (const v of violations) {
      const flagId = crypto.randomUUID();
      const flag = {
        id: flagId,
        entryId: event.entryId || null,
        userId,
        ruleCode: v.ruleCode,
        severity: v.severity,
        status: "OPEN",
        metadata: v.metadata || {},
        createdAt: new Date().toISOString(),
      };

      if (this.pool) {
        await this.pool.query(
          `INSERT INTO risk_flags (id, entry_id, user_id, rule_code, severity, status, metadata)
           VALUES ($1, $2, $3, $4, $5, 'OPEN', $6)`,
          [flag.id, flag.entryId, flag.userId, flag.ruleCode, flag.severity, JSON.stringify(flag.metadata)]
        );
      }

      flagsCreated.push(flag);

      // Trigger temporary hold / freeze if HIGH severity
      if (v.severity === "HIGH") {
        autoHoldTriggered = true;
        if (this.onAutoHold) {
          try {
            await this.onAutoHold({
              userId,
              flagId: flag.id,
              ruleCode: v.ruleCode,
              reason: `Automatic risk hold: ${v.ruleCode} triggered`,
            });
          } catch (err) {
            console.error(`[RiskService] Failed to trigger auto-hold for user ${userId}:`, err);
          }
        }
      }
    }

    return {
      userId,
      processed: true,
      flagsCreated,
      autoHoldTriggered,
    };
  }

  /**
   * List risk flags with optional filters.
   */
  async listFlags({ status = null, severity = null, userId = null, limit = 50, offset = 0 } = {}) {
    if (!this.pool) return [];

    let query = "SELECT * FROM risk_flags WHERE 1=1";
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }
    if (userId) {
      params.push(userId);
      query += ` AND user_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  /**
   * Review a flag and clear or confirm it.
   */
  async reviewFlag({ flagId, newStatus, reviewerNotes = null, onClearUnfreeze = null }) {
    if (!["CLEARED", "CONFIRMED"].includes(newStatus)) {
      const err = new Error("newStatus must be 'CLEARED' or 'CONFIRMED'");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    if (!this.pool) {
      return { id: flagId, status: newStatus, reviewerNotes };
    }

    const flagRes = await this.pool.query("SELECT * FROM risk_flags WHERE id = $1", [flagId]);
    if (flagRes.rows.length === 0) {
      const err = new Error(`Risk flag not found: ${flagId}`);
      err.code = "NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    const flag = flagRes.rows[0];

    const updated = await this.pool.query(
      `UPDATE risk_flags
       SET status = $1,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{review}',
             $2::jsonb
           ),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        newStatus,
        JSON.stringify({
          status: newStatus,
          notes: reviewerNotes,
          reviewedAt: new Date().toISOString(),
        }),
        flagId,
      ]
    );

    // If cleared and was high severity, trigger unfreeze callback
    if (newStatus === "CLEARED" && onClearUnfreeze) {
      await onClearUnfreeze({ userId: flag.user_id, flagId });
    }

    return updated.rows[0];
  }
}
