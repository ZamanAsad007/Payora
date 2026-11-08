import express from "express";
import { createNotificationRouter } from "./routes/notificationRoutes.js";

export function createApp(services = {}) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "notification-service", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({ success: true, data: { status: "ok", service: "notification-service" }, error: null });
  });

  app.use("/api/notifications", createNotificationRouter(services));

  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      data: null,
      error: {
        code: err.code || "INTERNAL_ERROR",
        message: err.message,
      },
    });
  });

  return app;
}
