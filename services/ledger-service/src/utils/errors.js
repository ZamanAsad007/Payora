/**
 * Application Error hierarchy for Payora Ledger Service.
 */

export class AppError extends Error {
  constructor(message, code = "INTERNAL_SERVER_ERROR", statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request payload", details = null) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = "Insufficient funds in wallet") {
    super(message, "INSUFFICIENT_FUNDS", 422);
  }
}

export class AccountFrozenError extends AppError {
  constructor(message = "Account is frozen and cannot process transfers") {
    super(message, "ACCOUNT_FROZEN", 403);
  }
}

export class LimitExceededError extends AppError {
  constructor(message = "Transaction limit exceeded") {
    super(message, "LIMIT_EXCEEDED", 422);
  }
}

export class InvalidPinError extends AppError {
  constructor(message = "Invalid transaction PIN", attemptsRemaining = null) {
    super(message, "INVALID_PIN", 401, attemptsRemaining ? { attemptsRemaining } : null);
  }
}

export class PinLockedError extends AppError {
  constructor(message = "Transaction PIN locked due to too many failed attempts") {
    super(message, "PIN_LOCKED", 403);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = "Idempotency key reused with different request payload") {
    super(message, "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY", 409);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}
