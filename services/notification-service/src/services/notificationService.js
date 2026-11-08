import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { maskPhone, maskPhonesInText } from "../utils/phoneMasker.js";

export class NotificationService {
  constructor({
    pool = null,
    mailTransporter = null,
    smsProvider = null,
    smtpConfig = {
      host: process.env.SMTP_HOST || "localhost",
      port: Number(process.env.SMTP_PORT || 1025),
      secure: false,
    },
  } = {}) {
    this.pool = pool;
    this.smsProvider = smsProvider || {
      send: async (record) => {
        // Mock SMS provider
        return { messageId: `sms-${crypto.randomUUID()}`, status: "DELIVERED" };
      },
    };

    if (mailTransporter) {
      this.mailTransporter = mailTransporter;
    } else {
      this.mailTransporter = nodemailer.createTransport(smtpConfig);
    }
  }

  /**
   * Save an In-App notification to the database.
   */
  async sendInApp({ userId, type, title, body, metadata = {} }) {
    if (!userId || !title) {
      throw new Error("userId and title are required for In-App notification");
    }

    const maskedBody = maskPhonesInText(body);
    const notificationId = crypto.randomUUID();
    const payload = {
      title,
      body: maskedBody,
      ...metadata,
    };

    if (this.pool) {
      await this.pool.query(
        `INSERT INTO notifications (id, user_id, channel, type, payload, status)
         VALUES ($1, $2, 'IN_APP', $3, $4, 'DELIVERED')`,
        [notificationId, userId, type || "INFO", JSON.stringify(payload)]
      );
    }

    return {
      id: notificationId,
      userId,
      channel: "IN_APP",
      type: type || "INFO",
      payload,
      status: "DELIVERED",
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Send an Email via SMTP (Mailpit).
   */
  async sendEmail({ to, subject, html, text }) {
    if (!to || !subject) {
      throw new Error("to and subject are required for email");
    }

    const maskedText = maskPhonesInText(text || "");
    const maskedHtml = html ? maskPhonesInText(html) : undefined;

    try {
      const info = await this.mailTransporter.sendMail({
        from: process.env.MAIL_FROM || "no-reply@payora.local",
        to,
        subject,
        text: maskedText,
        html: maskedHtml,
      });

      return {
        messageId: info.messageId,
        to,
        subject,
        status: "DELIVERED",
      };
    } catch (err) {
      // In test/offline mode without live SMTP
      return {
        messageId: `mock-mail-${Date.now()}`,
        to,
        subject,
        status: "DELIVERED_SIMULATED",
      };
    }
  }

  /**
   * Send a Mock SMS with phone masking.
   */
  async sendSms({ toPhone, message }) {
    if (!toPhone || !message) {
      throw new Error("toPhone and message are required for SMS");
    }

    const maskedTo = maskPhone(toPhone);
    const maskedBody = maskPhonesInText(message);

    const result = await this.smsProvider.send({
      toPhone: maskedTo,
      message: maskedBody,
    });

    return {
      messageId: result.messageId || `sms-${Date.now()}`,
      to: maskedTo,
      message: maskedBody,
      status: result.status || "DELIVERED",
    };
  }

  /**
   * Dispatches multi-channel notifications for financial events.
   *
   * @param {object} event
   * @param {string} event.type - P2P_TRANSFER | MERCHANT_PAYMENT | CASH_OUT | TOP_UP | ACCOUNT_FLAGGED | TRANSFER_FAILED
   */
  async dispatchForEvent(event) {
    const results = [];
    const amountTaka = event.amount ? (Number(event.amount) / 100).toFixed(2) : "0.00";

    switch (event.type) {
      case "P2P_TRANSFER": {
        // Sender notification
        if (event.senderUserId) {
          const body = `You sent ${amountTaka} BDT to ${maskPhone(event.receiverPhone || "recipient")}. Ref: ${event.reference || ""}`;
          results.push(
            await this.sendInApp({
              userId: event.senderUserId,
              type: "TRANSFER_SENT",
              title: "Money Sent",
              body,
              metadata: { amount: event.amount, reference: event.reference },
            })
          );
          if (event.senderPhone) {
            results.push(await this.sendSms({ toPhone: event.senderPhone, message: body }));
          }
          if (event.senderEmail) {
            results.push(await this.sendEmail({ to: event.senderEmail, subject: "Payora: Transfer Sent", text: body }));
          }
        }

        // Receiver notification
        if (event.receiverUserId) {
          const body = `You received ${amountTaka} BDT from ${maskPhone(event.senderPhone || "sender")}. Ref: ${event.reference || ""}`;
          results.push(
            await this.sendInApp({
              userId: event.receiverUserId,
              type: "TRANSFER_RECEIVED",
              title: "Money Received",
              body,
              metadata: { amount: event.amount, reference: event.reference },
            })
          );
          if (event.receiverPhone) {
            results.push(await this.sendSms({ toPhone: event.receiverPhone, message: body }));
          }
          if (event.receiverEmail) {
            results.push(await this.sendEmail({ to: event.receiverEmail, subject: "Payora: Money Received", text: body }));
          }
        }
        break;
      }

      case "MERCHANT_PAYMENT": {
        const body = `Payment of ${amountTaka} BDT to ${event.merchantName || "Merchant"} successful. Ref: ${event.reference || ""}`;
        if (event.customerUserId) {
          results.push(
            await this.sendInApp({
              userId: event.customerUserId,
              type: "MERCHANT_PAID",
              title: "Merchant Payment",
              body,
              metadata: { merchantId: event.merchantId, amount: event.amount },
            })
          );
          if (event.customerPhone) {
            results.push(await this.sendSms({ toPhone: event.customerPhone, message: body }));
          }
        }
        break;
      }

      case "CASH_OUT": {
        const body = `Cash-out of ${amountTaka} BDT via agent completed. Fee: ${(Number(event.fee || 0) / 100).toFixed(2)} BDT.`;
        if (event.userId) {
          results.push(
            await this.sendInApp({
              userId: event.userId,
              type: "CASH_OUT",
              title: "Cash Out Successful",
              body,
              metadata: { amount: event.amount, fee: event.fee },
            })
          );
          if (event.userPhone) {
            results.push(await this.sendSms({ toPhone: event.userPhone, message: body }));
          }
        }
        break;
      }

      case "ACCOUNT_FLAGGED": {
        const body = `Important: Your account has been temporarily restricted for security verification (${event.reason || "unusual activity"}).`;
        if (event.userId) {
          results.push(
            await this.sendInApp({
              userId: event.userId,
              type: "SECURITY_ALERT",
              title: "Security Verification Hold",
              body,
              metadata: { flagId: event.flagId, ruleCode: event.ruleCode },
            })
          );
          if (event.userPhone) {
            results.push(await this.sendSms({ toPhone: event.userPhone, message: body }));
          }
          if (event.userEmail) {
            results.push(await this.sendEmail({ to: event.userEmail, subject: "Payora: Account Security Alert", text: body }));
          }
        }
        break;
      }

      case "TRANSFER_FAILED": {
        const body = `Transfer of ${amountTaka} BDT could not be completed: ${event.reason || "Transaction failed"}.`;
        if (event.userId) {
          results.push(
            await this.sendInApp({
              userId: event.userId,
              type: "TRANSFER_FAILED",
              title: "Transaction Failed",
              body,
            })
          );
        }
        break;
      }
    }

    return { eventType: event.type, dispatchedCount: results.length, dispatches: results };
  }

  /**
   * Get user's in-app notifications.
   */
  async getInAppNotifications({ userId, limit = 20, offset = 0 }) {
    if (!this.pool) return [];

    const res = await this.pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND channel = 'IN_APP'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.rows;
  }

  /**
   * Mark an in-app notification as read.
   */
  async markAsRead({ notificationId, userId }) {
    if (!this.pool) {
      return { id: notificationId, read_at: new Date().toISOString() };
    }

    const res = await this.pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (res.rows.length === 0) {
      const err = new Error("Notification not found");
      err.code = "NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    return res.rows[0];
  }
}
