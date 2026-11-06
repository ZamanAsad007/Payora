import express from "express";
import { createAuthRouter } from "./routes/authRoutes.js";

export function createAuthApp(authService) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "auth-service", timestamp: new Date().toISOString() });
  });

  app.get("/api/auth/health", (req, res) => {
    res.status(200).json({ success: true, data: { status: "ok", service: "auth-service" }, error: null });
  });

  const authRouter = createAuthRouter(authService);
  app.use("/api/auth", authRouter);
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
