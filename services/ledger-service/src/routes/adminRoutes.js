import { Router } from "express";
import { AdminService } from "../services/adminService.js";
import { ReversalService } from "../services/reversalService.js";
import { ReconciliationService } from "../services/reconciliationService.js";

export function createAdminRouter({
  adminService = new AdminService(),
  reversalService = new ReversalService(),
  reconciliationService = new ReconciliationService(),
} = {}) {
  const router = Router();

  // POST /api/admin/transactions/:id/reverse - Admin reversal with compensating entries
  router.post("/transactions/:id/reverse", async (req, res, next) => {
    try {
      const { reason, actorId } = req.body || {};
      const result = await reversalService.reverseTransaction({
        entryId: req.params.id,
        actorId: actorId || req.headers["x-actor-id"] || null,
        reason: reason || "Admin manual reversal",
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

  // PATCH /api/admin/accounts/:id/freeze
  router.patch("/accounts/:id/freeze", async (req, res, next) => {
    try {
      const { reason, actorId } = req.body || {};
      const result = await adminService.freezeAccount({
        accountId: req.params.id,
        reason,
        actorId: actorId || req.headers["x-actor-id"] || null,
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
      const { reason, actorId } = req.body || {};
      const result = await adminService.unfreezeAccount({
        accountId: req.params.id,
        reason,
        actorId: actorId || req.headers["x-actor-id"] || null,
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

  // GET /api/admin/reconciliation - Latest report and historical list
  router.get("/reconciliation", async (req, res, next) => {
    try {
      const { history, limit, offset } = req.query;
      if (history === "true") {
        const reports = await reconciliationService.getReports({
          limit: limit ? parseInt(limit, 10) : 20,
          offset: offset ? parseInt(offset, 10) : 0,
        });
        return res.status(200).json({
          success: true,
          data: reports,
          error: null,
        });
      }

      const report = await reconciliationService.getLatestReport();
      res.status(200).json({
        success: true,
        data: report,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/reconciliation/run - Run reconciliation on demand
  router.post("/reconciliation/run", async (req, res, next) => {
    try {
      const report = await reconciliationService.runReconciliation();
      res.status(200).json({
        success: true,
        data: report,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/stats - Admin platform statistics
  router.get("/stats", async (req, res, next) => {
    try {
      const stats = await adminService.getAdminStats();
      res.status(200).json({
        success: true,
        data: stats,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/audit-logs - Audit trail
  router.get("/audit-logs", async (req, res, next) => {
    try {
      const { limit, offset, entity, action, actorId } = req.query;
      const logs = await adminService.getAuditLogs({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        entity,
        action,
        actorId,
      });
      res.status(200).json({
        success: true,
        data: logs,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/admin/limits/:userId
  router.put("/limits/:userId", async (req, res, next) => {
    try {
      const { dailySendLimit, perTxnLimit, monthlyLimit, actorId } = req.body;
      const result = await adminService.setUserLimits({
        userId: req.params.userId,
        dailySendLimit,
        perTxnLimit,
        monthlyLimit,
        actorId: actorId || req.headers["x-actor-id"] || null,
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
