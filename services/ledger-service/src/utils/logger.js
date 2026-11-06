import pino from "pino";

const redactPaths = [
  "pin",
  "pin_hash",
  "password",
  "password_hash",
  "token",
  "jwt",
  "authorization",
  "headers.authorization",
  "req.headers.authorization",
  "body.pin",
  "body.password",
  "body.token",
  "*.pin",
  "*.password",
  "*.token",
  "phone",
  "*.phone",
  "body.phone",
];

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

/**
 * Mask a phone number so only last 4 digits are visible (e.g., +88017****1234)
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== "string") return phone;
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "****";
  const visible = cleaned.slice(-4);
  const maskedPrefix = cleaned.slice(0, -4).replace(/[0-9]/g, "*");
  return `${maskedPrefix}${visible}`;
}
