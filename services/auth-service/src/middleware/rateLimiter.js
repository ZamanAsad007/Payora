/**
 * In-memory sliding window rate limiter for sensitive endpoints.
 * Automatically bypassed in test mode.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxRequests = 10,
  message = "Too many requests. Please try again later.",
} = {}) {
  const requests = new Map();

  // Periodic cleanup of stale IPs every 5 minutes
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter((t) => t > now - windowMs);
      if (valid.length === 0) requests.delete(ip);
      else requests.set(ip, valid);
    }
  }, 5 * 60 * 1000);
  interval.unref?.();

  return (req, res, next) => {
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const key = req.ip || req.headers["x-forwarded-for"] || "unknown-ip";
    const now = Date.now();
    const timestamps = (requests.get(key) || []).filter((t) => t > now - windowMs);

    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        data: null,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message,
        },
      });
    }

    timestamps.push(now);
    requests.set(key, timestamps);
    next();
  };
}
