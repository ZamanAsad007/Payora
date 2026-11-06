import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  // Basic request logging
  app.use((req, res, next) => {
    logger.info({ method: req.method, url: req.url }, `[Incoming Request] ${req.method} ${req.url}`);
    next();
  });

  // Top-level and API healthcheck endpoints
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "ledger-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: "ok",
        service: "ledger-service",
        timestamp: new Date().toISOString(),
      },
      error: null,
    });
  });

  // Standard error handling middleware
  app.use(errorHandler);

  return app;
}
