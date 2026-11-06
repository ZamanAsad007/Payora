import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Standard API error handling middleware.
 * Outputs consistent response format:
 * { "success": false, "data": null, "error": { "code": "...", "message": "...", "details": ... } }
 */
export function errorHandler(err, req, res, next) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError ? err.code : "INTERNAL_SERVER_ERROR";
  const message = isAppError ? err.message : "An unexpected server error occurred";

  // Log error with context
  if (statusCode >= 500) {
    logger.error(
      {
        err,
        method: req.method,
        url: req.originalUrl,
      },
      `[Unhandled Error] ${err.message}`
    );
  } else {
    logger.warn(
      {
        errorCode,
        statusCode,
        method: req.method,
        url: req.originalUrl,
      },
      `[Client Error] ${err.message}`
    );
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: errorCode,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
