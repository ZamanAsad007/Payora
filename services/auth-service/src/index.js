import { createAuthApp } from "./app.js";
import { getAuthEnv } from "./config/env.js";
import { closePool } from "./db/pool.js";

const env = getAuthEnv();
const app = createAuthApp();

const server = app.listen(env.PORT, () => {
  console.log(`[Auth Service] Running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

async function shutdown(signal) {
  console.log(`[Auth Service] Received ${signal}. Shutting down...`);
  server.close(async () => {
    try {
      await closePool();
      console.log("[Auth Service] Pool closed cleanly.");
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
