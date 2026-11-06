import { Router } from "express";
import { TopUpService } from "../services/topUpService.js";

export function createProviderRouter({ topUpService = new TopUpService() } = {}) {
  const router = Router();

  // POST /api/provider/webhook
  router.post("/webhook", async (req, res, next) => {
    try {
      const signature = req.headers["x-signature"];
      const timestamp = req.headers["x-timestamp"];

      const result = await topUpService.handleWebhook({
        payload: req.body,
        signature,
        timestamp,
      });

      res.status(200).json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
