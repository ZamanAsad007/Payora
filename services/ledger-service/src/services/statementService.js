import PDFDocument from "pdfkit";
import { getPool } from "../db/pool.js";
import { NotFoundError } from "../utils/errors.js";

export class StatementService {
  constructor(pool = null) {
    this.pool = pool;
  }

  getDbPool() {
    return this.pool || getPool();
  }

  /**
   * Fetch statement transactions with opening balance and running balances.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string|Date} [params.from]
   * @param {string|Date} [params.to]
   */
  async getStatementData({ userId, from = null, to = null }) {
    if (!userId) {
      const err = new Error("userId is required to generate statement");
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    }

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const client = await this.getDbPool().connect();
    try {
      // 1. Resolve user's account
      const accRes = await client.query(
        "SELECT id, owner_id, type, currency, balance, status FROM accounts WHERE owner_id = $1 AND type = 'USER_WALLET'",
        [userId]
      );

      if (accRes.rows.length === 0) {
        throw new NotFoundError(`User wallet account not found for user: ${userId}`);
      }
      const account = accRes.rows[0];
      const accountId = account.id;

      // 2. Compute opening balance before 'fromDate'
      const openingRes = await client.query(
        `SELECT
           COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END), 0) as opening_balance
         FROM ledger_lines
         WHERE account_id = $1 AND created_at < $2`,
        [accountId, fromDate]
      );
      let runningBalance = BigInt(openingRes.rows[0]?.opening_balance || 0);
      const openingBalance = runningBalance;

      // 3. Fetch all ledger lines within [fromDate, toDate]
      const linesRes = await client.query(
        `SELECT l.id, l.entry_id, l.account_id, l.direction, l.amount, l.created_at,
                j.type, j.status, j.reference, j.description
         FROM ledger_lines l
         JOIN journal_entries j ON j.id = l.entry_id
         WHERE l.account_id = $1 AND l.created_at >= $2 AND l.created_at <= $3
         ORDER BY l.created_at ASC, l.id ASC`,
        [accountId, fromDate, toDate]
      );

      const items = linesRes.rows.map((row) => {
        const amount = BigInt(row.amount);
        if (row.direction === "CREDIT") {
          runningBalance += amount;
        } else {
          runningBalance -= amount;
        }

        return {
          id: row.id,
          entryId: row.entry_id,
          date: row.created_at,
          type: row.type,
          reference: row.reference,
          description: row.description || "",
          direction: row.direction,
          amountPoisha: amount.toString(),
          debitPoisha: row.direction === "DEBIT" ? amount.toString() : "0",
          creditPoisha: row.direction === "CREDIT" ? amount.toString() : "0",
          runningBalancePoisha: runningBalance.toString(),
          debitTaka: row.direction === "DEBIT" ? (Number(amount) / 100).toFixed(2) : "0.00",
          creditTaka: row.direction === "CREDIT" ? (Number(amount) / 100).toFixed(2) : "0.00",
          runningBalanceTaka: (Number(runningBalance) / 100).toFixed(2),
        };
      });

      return {
        account: {
          id: account.id,
          userId: account.owner_id,
          currency: account.currency,
          currentBalancePoisha: account.balance.toString(),
          currentBalanceTaka: (Number(account.balance) / 100).toFixed(2),
        },
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        openingBalancePoisha: openingBalance.toString(),
        openingBalanceTaka: (Number(openingBalance) / 100).toFixed(2),
        closingBalancePoisha: runningBalance.toString(),
        closingBalanceTaka: (Number(runningBalance) / 100).toFixed(2),
        totalTransactions: items.length,
        items,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Export statement as CSV string.
   */
  async exportCsv(statementData) {
    const headers = [
      "Date",
      "Reference",
      "Type",
      "Description",
      "Debit (BDT)",
      "Credit (BDT)",
      "Running Balance (BDT)",
    ];

    const rows = [headers.join(",")];

    // Opening balance row
    rows.push(
      `"${statementData.period.from}","OPENING_BALANCE","PERIOD_START","Opening Balance","0.00","0.00","${statementData.openingBalanceTaka}"`
    );

    for (const item of statementData.items) {
      const dateStr = new Date(item.date).toISOString();
      const escapedDesc = (item.description || "").replace(/"/g, '""');
      rows.push(
        `"${dateStr}","${item.reference}","${item.type}","${escapedDesc}","${item.debitTaka}","${item.creditTaka}","${item.runningBalanceTaka}"`
      );
    }

    return rows.join("\n");
  }

  /**
   * Export statement as PDF buffer.
   */
  async exportPdf(statementData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const buffers = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(err));

        // Header
        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("PAYORA DIGITAL WALLET", { align: "center" });
        doc
          .fontSize(12)
          .font("Helvetica")
          .text("Account Statement", { align: "center" });
        doc.moveDown();

        // Meta info
        doc.fontSize(10);
        doc.text(`Account ID: ${statementData.account.id}`);
        doc.text(`User ID: ${statementData.account.userId}`);
        doc.text(`Period: ${statementData.period.from.split("T")[0]} to ${statementData.period.to.split("T")[0]}`);
        doc.text(`Opening Balance: ${statementData.openingBalanceTaka} BDT`);
        doc.text(`Closing Balance: ${statementData.closingBalanceTaka} BDT`);
        doc.moveDown();

        // Table header
        const tableTop = doc.y;
        doc.font("Helvetica-Bold");
        doc.text("Date", 40, tableTop, { width: 75 });
        doc.text("Reference", 120, tableTop, { width: 110 });
        doc.text("Type", 235, tableTop, { width: 75 });
        doc.text("Debit", 315, tableTop, { width: 65, align: "right" });
        doc.text("Credit", 385, tableTop, { width: 65, align: "right" });
        doc.text("Balance", 455, tableTop, { width: 85, align: "right" });

        doc
          .moveTo(40, doc.y + 2)
          .lineTo(550, doc.y + 2)
          .stroke();
        doc.moveDown(0.5);

        // Rows
        doc.font("Helvetica");
        for (const item of statementData.items) {
          if (doc.y > 750) {
            doc.addPage();
          }
          const y = doc.y;
          const dateShort = new Date(item.date).toISOString().split("T")[0];
          doc.text(dateShort, 40, y, { width: 75 });
          doc.text(item.reference.slice(0, 15), 120, y, { width: 110 });
          doc.text(item.type, 235, y, { width: 75 });
          doc.text(item.debitTaka, 315, y, { width: 65, align: "right" });
          doc.text(item.creditTaka, 385, y, { width: 65, align: "right" });
          doc.text(item.runningBalanceTaka, 455, y, { width: 85, align: "right" });
          doc.moveDown(0.4);
        }

        doc.moveDown();
        doc
          .fontSize(8)
          .font("Helvetica-Oblique")
          .text("This is an electronically generated statement from Payora Ledger.", {
            align: "center",
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
