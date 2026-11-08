import { Router } from "express";
import { CashOutService } from "../services/cashOutService.js";

export function createCashOutRouter({ cashOutService = new CashOutService() } = {}) {
  const router = Router();

  // POST /api/cash-out
  router.post("/", async (req, res, next) => {
    try {
      const idempotencyKey = req.headers["idempotency-key"];
      const userId = req.headers["x-user-id"] || req.body.userId;
      const { amount, agentAccountId } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "userId and amount are required for cash-out",
          },
        });
      }

      const result = await cashOutService.cashOut({
        userId,
        agentAccountId,
        amountPoisha: amount,
        idempotencyKey,
      });

      res.status(result.statusCode).json({
        success: true,
        data: result.data,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
