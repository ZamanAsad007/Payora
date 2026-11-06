import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid PostgreSQL connection URL" }),
  REDIS_URL: z.string().url({ message: "REDIS_URL must be a valid Redis connection URL" }),
  JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters long" }),
  WEBHOOK_SECRET: z.string().min(32, { message: "WEBHOOK_SECRET must be at least 32 characters long" }),
});

/**
 * Validates environment variables and returns typed config.
 * Throws immediately with a formatted error if any required variable is missing or invalid.
 */
export function validateEnv(source = process.env) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const message = `\n[Config Error] Environment validation failed:\n${errorDetails}\nExiting.\n`;
    console.error(message);
    throw new Error(message);
  }

  return Object.freeze(result.data);
}

// Lazy-loaded or default-parsed env
let cachedEnv = null;
export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = validateEnv(process.env);
  }
  return cachedEnv;
}
