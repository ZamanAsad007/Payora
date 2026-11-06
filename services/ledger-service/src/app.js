import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";
import { createWalletRouter } from "./routes/walletRoutes.js";
import { createProviderRouter } from "./routes/providerRoutes.js";
import { createTransferRouter } from "./routes/transferRoutes.js";

export function createApp(services = {}) {
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

  // API Routes
  app.use("/api/wallet", createWalletRouter(services));
  app.use("/api/provider", createProviderRouter(services));
  app.use("/api/transfers", createTransferRouter(services));

  // Standard error handling middleware
  app.use(errorHandler);

  return app;
}
