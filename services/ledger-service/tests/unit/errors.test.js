import { describe, it, expect, jest } from "@jest/globals";
import {
  AppError,
  InsufficientFundsError,
  AccountFrozenError,
  IdempotencyConflictError,
  ValidationError,
} from "../../src/utils/errors.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";

describe("Application Errors & Middleware", () => {
  it("formats standard AppError correctly", () => {
    const error = new InsufficientFundsError();
    expect(error.code).toBe("INSUFFICIENT_FUNDS");
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe("Insufficient funds in wallet");
  });

  it("handles AccountFrozenError code and status", () => {
    const error = new AccountFrozenError();
    expect(error.code).toBe("ACCOUNT_FROZEN");
    expect(error.statusCode).toBe(403);
  });

  it("handles IdempotencyConflictError code and status", () => {
    const error = new IdempotencyConflictError();
    expect(error.code).toBe("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY");
    expect(error.statusCode).toBe(409);
  });

  it("errorHandler formats response according to standard API contract", () => {
    const req = { method: "POST", originalUrl: "/api/transfers" };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    const error = new ValidationError("Amount is required", { field: "amount" });
    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Amount is required",
        details: { field: "amount" },
      },
    });
  });

  it("errorHandler handles unhandled generic errors as 500", () => {
    const req = { method: "GET", originalUrl: "/api/wallet" };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    const genericError = new Error("Database network failure");
    errorHandler(genericError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected server error occurred",
      },
    });
  });
});
