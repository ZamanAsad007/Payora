import { Router } from "express";
import { MerchantService } from "../services/merchantService.js";

export function createMerchantRouter({ merchantService = new MerchantService() } = {}) {
  const router = Router();

  // POST /api/merchants - Register merchant
  router.post("/", async (req, res, next) => {
    try {
      const ownerId = req.headers["x-user-id"] || req.body.ownerId;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Merchant name is required" },
        });
      }

      const merchant = await merchantService.createMerchant({ ownerId, name });
      res.status(201).json({
        success: true,
        data: merchant,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/merchants/:id - Get merchant details
  router.get("/:id", async (req, res, next) => {
    try {
      const merchant = await merchantService.getMerchantById(req.params.id);
      res.status(200).json({
        success: true,
        data: {
          ...merchant,
          balance: merchant.balance.toString(),
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/merchants/:id/qr - Get merchant QR code
  router.get("/:id/qr", async (req, res, next) => {
    try {
      const merchant = await merchantService.getMerchantById(req.params.id);
      res.status(200).json({
        success: true,
        data: {
          merchantId: merchant.id,
          name: merchant.name,
          qrCode: merchant.qrCode,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createPaymentRouter({ merchantService = new MerchantService() } = {}) {
  const router = Router();

  // POST /api/payments/merchant - Pay a merchant
  router.post("/merchant", async (req, res, next) => {
    try {
      const idempotencyKey = req.headers["idempotency-key"];
      const customerUserId = req.headers["x-user-id"] || req.body.customerUserId;
      const { merchantId, qrPayload, amount } = req.body;

      if (!customerUserId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: "customerUserId is required" },
        });
      }

      const result = await merchantService.payMerchant({
        customerUserId,
        merchantId,
        qrPayload,
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
