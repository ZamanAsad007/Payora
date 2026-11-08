import { Router } from "express";
import { AdminService } from "../services/adminService.js";

export function createAdminRouter({ adminService = new AdminService() } = {}) {
  const router = Router();

  // PATCH /api/admin/accounts/:id/freeze
  router.patch("/accounts/:id/freeze", async (req, res, next) => {
    try {
      const { reason } = req.body || {};
      const result = await adminService.freezeAccount({
        accountId: req.params.id,
        reason,
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

  // PATCH /api/admin/accounts/:id/unfreeze
  router.patch("/accounts/:id/unfreeze", async (req, res, next) => {
    try {
      const { reason } = req.body || {};
      const result = await adminService.unfreezeAccount({
        accountId: req.params.id,
        reason,
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

  // PUT /api/admin/limits/:userId
  router.put("/limits/:userId", async (req, res, next) => {
    try {
      const { dailySendLimit, perTxnLimit, monthlyLimit } = req.body;
      const result = await adminService.setUserLimits({
        userId: req.params.userId,
        dailySendLimit,
        perTxnLimit,
        monthlyLimit,
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

  // GET /api/admin/limits/:userId
  router.get("/limits/:userId", async (req, res, next) => {
    try {
      const result = await adminService.getUserLimits(req.params.userId);
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
