/**
 * Utility for masking phone numbers to protect user privacy.
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== "string") return phone;

  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  // Need at least 7 digits to mask
  if (digitsOnly.length < 7) {
    return "****";
  }

  // Preserve prefix (first 5 chars for +88017 / 01712) and suffix (last 4 chars)
  if (trimmed.startsWith("+")) {
    const prefix = trimmed.slice(0, 6);
    const suffix = trimmed.slice(-4);
    return `${prefix}****${suffix}`;
  }

  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * Redact / mask all phone numbers in arbitrary message text.
 */
export function maskPhonesInText(text) {
  if (!text || typeof text !== "string") return text;

  // Regex matching E.164 (+8801...) and local Bangladeshi (01...) or 10-15 digit phone patterns
  const phonePattern = /(\+?8801[3-9]\d{8}|01[3-9]\d{8}|\+\d{10,14})/g;

  return text.replace(phonePattern, (match) => maskPhone(match));
}
