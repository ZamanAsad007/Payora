import { Router } from "express";
import { NotificationService } from "../services/notificationService.js";

export function createNotificationRouter({ notificationService = new NotificationService() } = {}) {
  const router = Router();

  // POST /api/notifications/dispatch
  router.post("/dispatch", async (req, res, next) => {
    try {
      const { channel, userId, to, toPhone, subject, title, body, message } = req.body;

      let result;
      if (channel === "IN_APP") {
        result = await notificationService.sendInApp({ userId, title, body });
      } else if (channel === "EMAIL") {
        result = await notificationService.sendEmail({ to, subject, text: body || message });
      } else if (channel === "SMS") {
        result = await notificationService.sendSms({ toPhone, message: body || message });
      } else {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "INVALID_CHANNEL", message: "Channel must be IN_APP, EMAIL, or SMS" },
        });
      }

      res.status(200).json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/notifications/event
  router.post("/event", async (req, res, next) => {
    try {
      const result = await notificationService.dispatchForEvent(req.body);
      res.status(200).json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/notifications
  router.get("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "MISSING_USER_ID", message: "x-user-id header or userId query required" },
        });
      }

      const { limit, offset } = req.query;
      const notifications = await notificationService.getInAppNotifications({
        userId,
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
      });

      res.status(200).json({ success: true, data: notifications, error: null });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/notifications/:id/read
  router.patch("/:id/read", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.body.userId || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "MISSING_USER_ID", message: "x-user-id header or userId query required" },
        });
      }

      const updated = await notificationService.markAsRead({
        notificationId: req.params.id,
        userId,
      });

      res.status(200).json({ success: true, data: updated, error: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
