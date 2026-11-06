import { verifyAccessToken } from "../utils/jwt.js";
import { getAuthEnv } from "../config/env.js";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token missing or invalid",
      },
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const env = getAuthEnv();
    const payload = verifyAccessToken(token, env.JWT_SECRET);
    req.user = {
      id: payload.userId,
      phone: payload.phone,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: "TOKEN_INVALID",
        message: "Token has expired or is invalid",
      },
    });
  }
}
