import { z } from "zod";

export const authEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid PostgreSQL connection URL" }),
  JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters long" }),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(7),
  LEDGER_SERVICE_URL: z.string().url().default("http://localhost:3000"),
});

export function validateAuthEnv(source = process.env) {
  const result = authEnvSchema.safeParse(source);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const message = `\n[Auth Config Error] Environment validation failed:\n${errorDetails}\nExiting.\n`;
    console.error(message);
    throw new Error(message);
  }

  return Object.freeze(result.data);
}

let cachedAuthEnv = null;
export function getAuthEnv() {
  if (!cachedAuthEnv) {
    cachedAuthEnv = validateAuthEnv(process.env);
  }
  return cachedAuthEnv;
}
