import { Router } from "express";
import { TransferService } from "../services/transferService.js";

export function createTransferRouter({ transferService = new TransferService() } = {}) {
  const router = Router();

  // POST /api/transfers
  router.post("/", async (req, res, next) => {
    try {
      const idempotencyKey = req.headers["idempotency-key"];
      const senderUserId = req.headers["x-user-id"] || req.body.senderUserId;
      const { receiverPhone, amount } = req.body;

      if (!senderUserId || !receiverPhone || !amount) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "senderUserId, receiverPhone, and amount are required",
          },
        });
      }

      const result = await transferService.transferP2P({
        senderUserId,
        receiverPhone,
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
