import { z } from "zod";

export const providerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3004),
  WEBHOOK_SECRET: z.string().min(32, { message: "WEBHOOK_SECRET must be at least 32 characters long" }),
  LEDGER_SERVICE_URL: z.string().url().default("http://localhost:3000"),
});

export function validateProviderEnv(source = process.env) {
  const result = providerEnvSchema.safeParse(source);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`[Mock Provider Config Error]:\n${errorDetails}`);
  }
  return Object.freeze(result.data);
}

let cachedProviderEnv = null;
export function getProviderEnv() {
  if (!cachedProviderEnv) {
    cachedProviderEnv = validateProviderEnv(process.env);
  }
  return cachedProviderEnv;
}
