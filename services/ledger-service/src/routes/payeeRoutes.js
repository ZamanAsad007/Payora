import { Router } from "express";
import { PayeeService } from "../services/payeeService.js";

export function createPayeeRouter({ payeeService = new PayeeService() } = {}) {
  const router = Router();

  // GET /api/payees
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

      const payees = await payeeService.listPayees({ userId });
      res.status(200).json({
        success: true,
        data: payees,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/payees
  router.post("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.body.userId;
      const { payeeAccountId, payeePhone, nickname } = req.body;

      if (!userId || !nickname || (!payeeAccountId && !payeePhone)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "userId, nickname, and either payeeAccountId or payeePhone are required",
          },
        });
      }

      const payee = await payeeService.addPayee({
        userId,
        payeeAccountId,
        payeePhone,
        nickname,
      });

      res.status(201).json({
        success: true,
        data: payee,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/payees/:id
  router.delete("/:id", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.body.userId || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "MISSING_USER_ID", message: "User ID required in x-user-id header or query" },
        });
      }

      const result = await payeeService.deletePayee({
        userId,
        payeeId: req.params.id,
      });

      res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
