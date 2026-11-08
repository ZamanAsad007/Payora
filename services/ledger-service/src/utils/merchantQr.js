import crypto from "node:crypto";

/**
 * Utility for generating and validating server-signed Merchant QR codes.
 */
export class MerchantQr {
  /**
   * Generate signed merchant QR payload string.
   *
   * @param {object} params
   * @param {string} params.merchantId
   * @param {string} params.accountId
   * @param {string} params.name
   * @param {bigint|number|string} [params.amount] - Optional preset payment amount in poisha
   * @param {string} [params.secret]
   * @returns {string} base64 encoded signed QR code payload
   */
  static generate({
    merchantId,
    accountId,
    name,
    amount = null,
    secret = process.env.JWT_SECRET || "default_merchant_qr_secret_key_32chars",
  }) {
    if (!merchantId || !accountId) {
      throw new Error("merchantId and accountId are required to generate QR code");
    }

    const payload = {
      type: "PAYORA_MERCHANT_QR",
      merchantId,
      accountId,
      name,
      amount: amount !== null && amount !== undefined ? amount.toString() : null,
      createdAt: Date.now(),
    };

    const serialized = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(serialized)
      .digest("hex");

    const fullPayload = {
      ...payload,
      sig: signature,
    };

    return Buffer.from(JSON.stringify(fullPayload), "utf-8").toString("base64");
  }

  /**
   * Verify and parse a signed merchant QR payload.
   *
   * @param {string} qrString - Base64 encoded or JSON QR payload string, or plain UUID
   * @param {string} [secret]
   * @returns {{ valid: boolean, payload?: object, error?: string }}
   */
  static verify(
    qrString,
    secret = process.env.JWT_SECRET || "default_merchant_qr_secret_key_32chars"
  ) {
    if (!qrString || typeof qrString !== "string") {
      return { valid: false, error: "QR code payload is required" };
    }

    try {
      let jsonString;
      try {
        jsonString = Buffer.from(qrString, "base64").toString("utf-8");
      } catch {
        jsonString = qrString;
      }

      const parsed = JSON.parse(jsonString);

      if (parsed.type !== "PAYORA_MERCHANT_QR" || !parsed.merchantId || !parsed.sig) {
        return { valid: false, error: "Malformed merchant QR code format" };
      }

      const { sig, ...dataWithoutSig } = parsed;
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(dataWithoutSig))
        .digest("hex");

      const sigBuf = Buffer.from(sig, "hex");
      const expectedBuf = Buffer.from(expectedSig, "hex");

      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { valid: false, error: "Invalid merchant QR code signature" };
      }

      return { valid: true, payload: parsed };
    } catch (err) {
      // If it's a plain UUID (direct merchant ID lookup fallback)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(qrString.trim())) {
        return { valid: true, payload: { merchantId: qrString.trim(), isRawId: true } };
      }

      return { valid: false, error: `Failed to parse QR code: ${err.message}` };
    }
  }
}
