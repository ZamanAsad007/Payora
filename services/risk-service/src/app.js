import express from "express";
import helmet from "helmet";
import { createRiskRouter } from "./routes/riskRoutes.js";
import { logger } from "./utils/logger.js";

export function createApp(services = {}) {
  const app = express();

  // Security headers via Helmet
  app.use(helmet());

  app.use(express.json({ limit: "1mb" }));

  // Request logging
  app.use((req, res, next) => {
    logger.info({ method: req.method, url: req.url }, `[Incoming Request] ${req.method} ${req.url}`);
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "risk-service", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({ success: true, data: { status: "ok", service: "risk-service" }, error: null });
  });

  app.use("/api/risk", createRiskRouter(services));
  app.use("/api/admin/risk", createRiskRouter(services));

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
