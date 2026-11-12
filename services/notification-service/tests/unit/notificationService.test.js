import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { maskPhone, maskPhonesInText } from "../../src/utils/phoneMasker.js";
import { NotificationService } from "../../src/services/notificationService.js";
import { createApp } from "../../src/app.js";

function createMockDb() {
  const notifications = new Map();

  const mockPool = {
    query: async (sql, params = []) => {
      const s = sql.trim();

      if (s.startsWith("INSERT INTO notifications")) {
        const item = {
          id: params[0],
          user_id: params[1],
          channel: "IN_APP",
          type: params[2],
          payload: typeof params[3] === "string" ? JSON.parse(params[3]) : params[3],
          status: "DELIVERED",
          created_at: new Date(),
          read_at: null,
        };
        notifications.set(item.id, item);
        return { rows: [item] };
      }

      if (s.startsWith("SELECT") && s.includes("FROM notifications") && s.includes("user_id = $1")) {
        const userItems = Array.from(notifications.values()).filter((n) => n.user_id === params[0]);
        return { rows: userItems };
      }

      if (s.startsWith("UPDATE notifications") && s.includes("SET read_at = NOW()")) {
        const item = notifications.get(params[0]);
        if (item && item.user_id === params[1]) {
          item.read_at = new Date();
          return { rows: [item] };
        }
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  return { mockPool, notifications };
}

describe("Notification Service & Phone Masker", () => {
  describe("Phone Masking utility", () => {
    it("masks Bangladeshi phone numbers properly", () => {
      expect(maskPhone("+8801712345678")).toBe("+88017****5678");
      expect(maskPhone("01712345678")).toBe("017****5678");
      expect(maskPhone("+8801898765432")).toBe("+88018****5432");
    });

    it("masks phone numbers embedded inside text messages", () => {
      const msg = "Transfer of 500 BDT sent to 01712345678 successfully.";
      expect(maskPhonesInText(msg)).toBe("Transfer of 500 BDT sent to 017****5678 successfully.");

      const msg2 = "Received from +8801712345678 via agent 01812345678.";
      expect(maskPhonesInText(msg2)).toBe("Received from +88017****5678 via agent 018****5678.");
    });
  });

  describe("Multi-channel NotificationService", () => {
    let mockDb;
    let smsSent;
    let emailsSent;
    let notificationService;

    beforeEach(() => {
      mockDb = createMockDb();
      smsSent = [];
      emailsSent = [];

      const mockTransporter = {
        sendMail: async (mail) => {
          emailsSent.push(mail);
          return { messageId: "mail-id-123" };
        },
      };

      const mockSmsProvider = {
        send: async (sms) => {
          smsSent.push(sms);
          return { messageId: "sms-id-456", status: "DELIVERED" };
        },
      };

      notificationService = new NotificationService({
        pool: mockDb.mockPool,
        mailTransporter: mockTransporter,
        smsProvider: mockSmsProvider,
      });
    });

    it("dispatches multi-channel notifications for P2P transfer event with phone masking", async () => {
      const event = {
        type: "P2P_TRANSFER",
        senderUserId: "user-alice",
        senderPhone: "01711112222",
        senderEmail: "alice@example.com",
        receiverUserId: "user-bob",
        receiverPhone: "01733334444",
        receiverEmail: "bob@example.com",
        amount: "50000", // 500.00 BDT
        reference: "ref-test-123",
      };

      const res = await notificationService.dispatchForEvent(event);
      expect(res.dispatchedCount).toBeGreaterThan(0);

      // Verify in-app notifications created in DB
      const aliceInApp = Array.from(mockDb.notifications.values()).find((n) => n.user_id === "user-alice");
      expect(aliceInApp).toBeDefined();
      expect(aliceInApp.payload.body).toContain("017****4444");

      const bobInApp = Array.from(mockDb.notifications.values()).find((n) => n.user_id === "user-bob");
      expect(bobInApp).toBeDefined();
      expect(bobInApp.payload.body).toContain("017****2222");

      // Verify SMS
      expect(smsSent.length).toBe(2);
      expect(smsSent[0].toPhone).toBe("017****2222");
      expect(smsSent[1].toPhone).toBe("017****4444");

      // Verify Email
      expect(emailsSent.length).toBe(2);
      expect(emailsSent[0].to).toBe("alice@example.com");
      expect(emailsSent[1].to).toBe("bob@example.com");
    });

    it("dispatches security alert when account is flagged", async () => {
      const res = await notificationService.dispatchForEvent({
        type: "ACCOUNT_FLAGGED",
        userId: "user-flagged",
        userPhone: "+8801755556666",
        userEmail: "flagged@example.com",
        reason: "velocity spike",
        ruleCode: "VELOCITY_SPIKE",
      });

      expect(res.dispatchedCount).toBe(3);
      expect(smsSent[0].toPhone).toBe("+88017****6666");
      expect(emailsSent[0].subject).toContain("Account Security Alert");
    });

    it("fetches and marks in-app notification as read", async () => {
      const created = await notificationService.sendInApp({
        userId: "user-1",
        title: "Test Alert",
        body: "Your balance is updated.",
      });

      const list = await notificationService.getInAppNotifications({ userId: "user-1" });
      expect(list.length).toBe(1);

      const read = await notificationService.markAsRead({
        notificationId: created.id,
        userId: "user-1",
      });
      expect(read.read_at).toBeDefined();
    });
  });

  describe("HTTP Routes (Supertest)", () => {
    it("handles dispatch, in-app listing, and mark as read via HTTP", async () => {
      const { mockPool } = createMockDb();
      const notificationService = new NotificationService({ pool: mockPool });
      const app = createApp({ notificationService });

      // 1. Health check
      const healthRes = await request(app).get("/health");
      expect(healthRes.status).toBe(200);

      // 2. Dispatch in-app notification
      const dispatchRes = await request(app)
        .post("/api/notifications/dispatch")
        .send({
          channel: "IN_APP",
          userId: "user-test-api",
          title: "Payment Received",
          body: "500 BDT from 01712345678",
          type: "PAYMENT_ALERT",
        });

      expect(dispatchRes.status).toBe(200);
      expect(dispatchRes.body.success).toBe(true);
      expect(dispatchRes.body.data.type).toBe("PAYMENT_ALERT");
      const notificationId = dispatchRes.body.data.id;

      // 3. List notifications
      const listRes = await request(app)
        .get("/api/notifications")
        .set("x-user-id", "user-test-api");

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].payload.body).toContain("017****5678");

      // 4. Mark as read
      const readRes = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set("x-user-id", "user-test-api");

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.read_at).toBeDefined();
    });
  });
});
