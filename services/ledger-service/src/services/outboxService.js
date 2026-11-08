import crypto from "node:crypto";
import { getPool } from "../db/pool.js";

export class OutboxService {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Insert outbox event within an existing database transaction client.
   *
   * @param {object} client - pg client with active transaction
   * @param {object} event
   * @param {string} event.topic
   * @param {object} event.payload
   */
  static async recordEvent(client, { topic, payload }) {
    if (!client || typeof client.query !== "function") {
      throw new Error("A database client is required to write to outbox");
    }

    const eventId = payload.eventId || crypto.randomUUID();
    const eventPayload = {
      ...payload,
      eventId,
      createdAt: payload.createdAt || new Date().toISOString(),
    };

    const res = await client.query(
      `INSERT INTO outbox (topic, payload)
       VALUES ($1, $2)
       RETURNING id, topic, payload, created_at`,
      [topic, JSON.stringify(eventPayload)]
    );

    return res.rows[0];
  }

  /**
   * Process and publish unpublished outbox events.
   *
   * @param {object} params
   * @param {number} [params.batchSize=50]
   * @param {Function} params.publishFn - async function(event)
   */
  async publishBatch({ batchSize = 50, publishFn = null }) {
    const client = await this.getDbPool().connect();
    try {
      await client.query("BEGIN");

      const selectRes = await client.query(
        `SELECT id, topic, payload, created_at
         FROM outbox
         WHERE published_at IS NULL
         ORDER BY id ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [batchSize]
      );

      const events = selectRes.rows;
      const publishedIds = [];

      for (const ev of events) {
        if (publishFn) {
          await publishFn(ev);
        }
        publishedIds.push(ev.id);
      }

      if (publishedIds.length > 0) {
        await client.query(
          `UPDATE outbox
           SET published_at = NOW()
           WHERE id = ANY($1::bigint[])`,
          [publishedIds]
        );
      }

      await client.query("COMMIT");
      return { publishedCount: publishedIds.length, publishedIds };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
