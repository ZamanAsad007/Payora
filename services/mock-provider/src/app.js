import express from "express";
import { generateWebhookSignature } from "./utils/signature.js";
import { getProviderEnv } from "./config/env.js";

export function createProviderApp(customEnv = null) {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "mock-provider" });
  });

  // Top-Up initiation endpoint
  app.post("/api/provider/initiate", async (req, res) => {
    const { topUpId, amount, providerRef, callbackUrl } = req.body;

    if (!topUpId || !amount || !providerRef) {
      return res.status(400).json({
        success: false,
        error: "topUpId, amount, and providerRef are required",
      });
    }

    const env = customEnv || getProviderEnv();

    // Prepare simulated webhook payload
    const timestamp = Math.floor(Date.now() / 1000);
    const callbackPayload = {
      providerRef,
      topUpId,
      status: "SUCCESS",
      amount,
      timestamp,
    };

    const { signature } = generateWebhookSignature(callbackPayload, env.WEBHOOK_SECRET, timestamp);

    // If callbackUrl provided, dispatch webhook asynchronously (or simulated response)
    if (callbackUrl) {
      fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
          "X-Timestamp": timestamp.toString(),
        },
        body: JSON.stringify(callbackPayload),
      }).catch((err) => {
        console.error("[Mock Provider] Webhook dispatch error:", err.message);
      });
    }

    res.status(200).json({
      success: true,
      data: {
        providerRef,
        status: "INITIATED",
        simulatedWebhook: {
          payload: callbackPayload,
          signature,
          timestamp,
        },
      },
    });
  });

  return app;
}
