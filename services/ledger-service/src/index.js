import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { closePool } from "./db/pool.js";

// Fail-fast validate environment before anything else boots
const env = getEnv();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Payora Ledger Service running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info("HTTP server closed.");
    try {
      await closePool();
      logger.info("Database pool closed.");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during database pool shutdown");
      process.exit(1);
    }
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
