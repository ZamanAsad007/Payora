import { Router } from "express";
import { AuthService } from "../services/authService.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

export function createAuthRouter(authService = new AuthService()) {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({
        success: true,
        data: { user },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const fingerprint = req.headers["x-device-fingerprint"] || req.body.fingerprint;
      const result = await authService.login({
        phone: req.body.phone,
        password: req.body.password,
        fingerprint,
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

  router.post("/refresh", async (req, res, next) => {
    try {
      const result = await authService.refresh({
        refreshToken: req.body.refreshToken,
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

  router.post("/logout", async (req, res, next) => {
    try {
      await authService.logout({
        refreshToken: req.body.refreshToken,
      });

      res.status(200).json({
        success: true,
        data: { message: "Logged out successfully" },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/pin", authenticateToken, async (req, res, next) => {
    try {
      const result = await authService.setPin({
        userId: req.user.id,
        pin: req.body.pin,
        oldPin: req.body.oldPin,
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

  router.post("/pin/verify", authenticateToken, async (req, res, next) => {
    try {
      const result = await authService.verifyPin({
        userId: req.user.id,
        pin: req.body.pin,
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
