import { Router } from "express";
import { WalletService } from "../services/walletService.js";
import { TopUpService } from "../services/topUpService.js";

export function createWalletRouter({
  walletService = new WalletService(),
  topUpService = new TopUpService(),
} = {}) {
  const router = Router();

  // GET /api/wallet (balance & limits)
  router.get("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "MISSING_USER_ID", message: "User ID required in x-user-id header or query" },
        });
      }

      const balance = await walletService.getBalance({ userId });
      res.status(200).json({ success: true, data: balance, error: null });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/wallet/transactions (cursor pagination)
  router.get("/transactions", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "MISSING_USER_ID", message: "User ID required in x-user-id header or query" },
        });
      }

      const { cursor, limit, type } = req.query;
      const history = await walletService.getTransactions({
        userId,
        cursor,
        limit: limit ? Number(limit) : 20,
        type,
      });

      res.status(200).json({ success: true, data: history, error: null });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/wallet/top-up
  router.post("/top-up", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.body.userId;
      const { amount, providerRef } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: "userId and amount are required" },
        });
      }

      const topUp = await topUpService.initiateTopUp({
        userId,
        amountPoisha: amount,
        providerRef,
      });

      res.status(201).json({ success: true, data: topUp, error: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
