import express from "express";
import helmet from "helmet";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";

export function createAuthApp(authService) {
  const app = express();

  // Security headers via Helmet
  app.use(helmet());

  app.use(express.json({ limit: "1mb" }));

  // Basic CORS headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "auth-service", timestamp: new Date().toISOString() });
  });

  app.get("/api/auth/health", (req, res) => {
    res.status(200).json({ success: true, data: { status: "ok", service: "auth-service" }, error: null });
  });

  // Apply rate limiter on auth routes (10 requests per 15 min per IP)
  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
    message: "Too many authentication attempts. Please try again after 15 minutes.",
  });

  const authRouter = createAuthRouter(authService);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/", authRouter);

  // Standardized error handler
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_SERVER_ERROR";
    res.status(statusCode).json({
      success: false,
      data: null,
      error: {
        code,
        message: err.message || "An unexpected error occurred",
        ...(err.details ? { details: err.details } : {}),
      },
    });
  });

  return app;
}
