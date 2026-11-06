import crypto from "node:crypto";

export function verifyWebhookSignature({
  payload,
  signature,
  timestamp,
  secret,
  toleranceSeconds = 300,
}) {
  if (!signature || !timestamp || !secret) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);

  // Check timestamp tolerance to prevent replay attacks
  if (Math.abs(now - ts) > toleranceSeconds) {
    return false;
  }

  const data = `${ts}.${typeof payload === "string" ? payload : JSON.stringify(payload)}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(data).digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
