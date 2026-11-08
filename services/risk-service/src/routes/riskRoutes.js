import { Router } from "express";
import { RiskService } from "../services/riskService.js";

export function createRiskRouter({ riskService = new RiskService() } = {}) {
  const router = Router();

  // POST /api/risk/evaluate
  router.post("/evaluate", async (req, res, next) => {
    try {
      const result = await riskService.processEvent(req.body);
      res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/risk/flags or /api/admin/risk/flags
  router.get("/flags", async (req, res, next) => {
    try {
      const { status, severity, userId, limit, offset } = req.query;
      const flags = await riskService.listFlags({
        status,
        severity,
        userId,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      });

      res.status(200).json({
        success: true,
        data: flags,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/risk/flags/:id/review
  router.post("/flags/:id/review", async (req, res, next) => {
    try {
      const { status, notes } = req.body;
      const updated = await riskService.reviewFlag({
        flagId: req.params.id,
        newStatus: status,
        reviewerNotes: notes,
      });

      res.status(200).json({
        success: true,
        data: updated,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
