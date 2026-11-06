import jwt from "jsonwebtoken";

export function signAccessToken(payload, secret, expiresIn = "15m") {
  if (!secret) throw new Error("JWT secret is required");
  return jwt.sign(payload, secret, {
    expiresIn,
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token, secret) {
  if (!token || !secret) {
    throw new Error("Token and secret are required for verification");
  }
  return jwt.verify(token, secret, { algorithms: ["HS256"] });
}
