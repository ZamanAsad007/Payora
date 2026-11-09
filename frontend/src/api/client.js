/**
 * Robust API Client with:
 * - JWT Bearer token authentication
 * - Transparent refresh token retry on 401
 * - Per-attempt UUIDv4 Idempotency-Key generation
 * - Error mapping to user-friendly messages
 */

function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "idemp-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

const ERROR_MESSAGES = {
  INSUFFICIENT_FUNDS: "Your wallet balance is insufficient to complete this transfer.",
  LIMIT_EXCEEDED: "This transaction exceeds your configured spending limit.",
  ACCOUNT_FROZEN: "This account is temporarily frozen for security review. Contact support.",
  INVALID_PIN: "Incorrect 5-digit transaction PIN. Please try again.",
  PIN_LOCKED: "Your PIN is temporarily locked due to 3 consecutive wrong attempts. Please wait 30 minutes.",
  PIN_NOT_SET: "Please set your 5-digit transaction PIN before transferring money.",
  DUPLICATE_REQUEST: "A request with this idempotency key was already processed.",
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY: "Idempotency conflict: key was reused with different payload.",
  RECIPIENT_NOT_FOUND: "Recipient wallet not found. Check phone number.",
  MERCHANT_NOT_FOUND: "Merchant account not found. Check merchant code.",
};

export class ApiError extends Error {
  constructor(message, code = "UNKNOWN_ERROR", status = 500, details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(endpoint, { method = "GET", body = null, headers = {}, requiresIdempotency = false } = {}) {
  let token = localStorage.getItem("payora_access_token");

  const reqHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  if (requiresIdempotency) {
    reqHeaders["Idempotency-Key"] = generateIdempotencyKey();
  }

  const config = {
    method,
    headers: reqHeaders,
  };

  if (body) {
    config.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(endpoint, config);
  } catch (netErr) {
    throw new ApiError("Network error. Unable to reach Payora services.", "NETWORK_ERROR", 0);
  }

  // Handle Token Expiry & Automatic Refresh
  if (response.status === 401 && !endpoint.includes("/api/auth/refresh") && !endpoint.includes("/api/auth/login")) {
    const refreshToken = localStorage.getItem("payora_refresh_token");
    if (refreshToken) {
      try {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccessToken = refreshData.data?.accessToken;
          if (newAccessToken) {
            localStorage.setItem("payora_access_token", newAccessToken);
            reqHeaders["Authorization"] = `Bearer ${newAccessToken}`;
            // Retry the original request
            response = await fetch(endpoint, { ...config, headers: reqHeaders });
          }
        } else {
          localStorage.removeItem("payora_access_token");
          localStorage.removeItem("payora_refresh_token");
          window.location.href = "/login";
        }
      } catch {
        // Continue to parse original 401
      }
    }
  }

  let json = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    json = await response.json();
  }

  if (!response.ok) {
    const errorCode = json?.error?.code || json?.code || "REQUEST_FAILED";
    const errorMessage =
      ERROR_MESSAGES[errorCode] ||
      json?.error?.message ||
      json?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(errorMessage, errorCode, response.status, json?.error?.details);
  }

  return json?.data !== undefined ? json.data : json;
}

export function formatTaka(poisha) {
  if (poisha === undefined || poisha === null) return "0.00";
  const num = Number(poisha) / 100;
  return num.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
