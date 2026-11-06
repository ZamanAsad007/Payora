import crypto from "node:crypto";

/**
 * Generate HMAC-SHA256 signature for webhook payloads.
 *
 * Signature input format: `${timestamp}.${serializedPayload}`
 */
export function generateWebhookSignature(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error("Webhook secret is required to generate signature");
  const data = `${timestamp}.${typeof payload === "string" ? payload : JSON.stringify(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return {
    signature,
    timestamp,
  };
}

/**
 * Verify HMAC-SHA256 signature with timestamp tolerance and timing-safe equality.
 */
export function verifyWebhookSignature({
  payload,
  signature,
  timestamp,
  secret,
  toleranceSeconds = 300, // 5 minutes tolerance
}) {
  if (!signature || !timestamp || !secret) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);

  // Check timestamp drift
  if (Math.abs(now - ts) > toleranceSeconds) {
    return false;
  }

  const expected = generateWebhookSignature(payload, secret, ts).signature;

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
